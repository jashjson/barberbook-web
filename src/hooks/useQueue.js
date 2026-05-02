import { useState, useEffect, useCallback, useRef } from 'react'
import { bookings as bookingsApi, realtime, analytics } from '../lib/supabase'
import { format } from 'date-fns'

const today = () => format(new Date(), 'yyyy-MM-dd')

// ── CUSTOMER: active booking + queue position ─────────────────────────────────
export function useCustomerBooking(userId, shopId) {
  const [activeBooking, setActiveBooking] = useState(null)
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  const fetchActive = useCallback(async () => {
    if (!userId) return
    const { data } = await bookingsApi.getUserActiveBooking(userId)
    setActiveBooking(data)
    return data
  }, [userId])

  const fetchQueue = useCallback(async (sid) => {
    if (!sid) return
    const { data } = await bookingsApi.getShopQueue(sid, today())
    setQueue(data || [])
  }, [])

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    const init = async () => {
      setLoading(true)
      const booking = await fetchActive()
      if (booking?.shop_id) await fetchQueue(booking.shop_id)
      setLoading(false)

      // Subscribe to real-time updates
      const targetShopId = booking?.shop_id || shopId
      if (targetShopId && !channelRef.current) {
        channelRef.current = realtime.subscribeShopQueue(targetShopId, () => {
          fetchActive()
          fetchQueue(targetShopId)
        })
      }
    }

    init()
    return () => { 
      if (channelRef.current) {
        realtime.unsubscribe(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId, shopId, fetchActive, fetchQueue])

  const myPosition = activeBooking
    ? queue.filter(q => q.status !== 'done' && q.status !== 'cancelled').findIndex(q => q.id === activeBooking.id) + 1
    : 0
  const ahead = Math.max(0, myPosition - 1)
  const estWait = ahead * 20 // 20 min per customer (configurable)

  return { activeBooking, queue, loading, myPosition, ahead, estWait, refresh: fetchActive }
}

// ── BARBER: today's full queue ────────────────────────────────────────────────
// Updated to use barber profile ID instead of barber record ID
export function useBarberQueue(barberProfileId) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  const fetch = useCallback(async () => {
    if (!barberProfileId) {
      console.log('[useBarberQueue] No barberProfileId provided')
      return
    }
    
    console.log('[useBarberQueue] Fetching queue for profile ID:', barberProfileId)
    
    try {
      const { data, error } = await bookingsApi.getBarberQueueByProfile(barberProfileId, today())
      
      console.log('[useBarberQueue] Response:', { 
        dataCount: data?.length || 0, 
        error: error?.message || error,
        data: data 
      })
      
      if (error) {
        console.error('[useBarberQueue] Error fetching barber queue:', error)
      }
      
      // Set queue data even if there's an error (fallback will return empty array)
      setQueue(data || [])
    } catch (err) {
      console.error('[useBarberQueue] Exception:', err)
      setQueue([])
    }
  }, [barberProfileId])

  useEffect(() => {
    if (!barberProfileId) { 
      console.log('[useBarberQueue] Effect: No barberProfileId, setting loading false')
      setLoading(false)
      return 
    }
    
    console.log('[useBarberQueue] Effect: Starting fetch for', barberProfileId)
    fetch().finally(() => {
      console.log('[useBarberQueue] Effect: Fetch complete, setting loading false')
      setLoading(false)
    })

    // Subscribe to real-time updates using profile ID
    if (!channelRef.current) {
      try {
        console.log('[useBarberQueue] Subscribing to real-time updates for', barberProfileId)
        channelRef.current = realtime.subscribeBarberQueueByProfile(barberProfileId, () => {
          console.log('[useBarberQueue] Real-time update received, refreshing...')
          fetch()
        })
      } catch (err) {
        console.error('[useBarberQueue] Error subscribing to barber queue:', err)
      }
    }
    return () => { 
      if (channelRef.current) {
        console.log('[useBarberQueue] Unsubscribing from real-time updates')
        realtime.unsubscribe(channelRef.current)
        channelRef.current = null
      }
    }
  }, [barberProfileId, fetch])

  const current = queue.find(q => q.status === 'in_chair')
  const waiting = queue.filter(q => q.status === 'waiting')
  const done    = queue.filter(q => q.status === 'done')

  return { queue, current, waiting, done, loading, refresh: fetch }
}

// ── OWNER: shop-wide queue + analytics ───────────────────────────────────────
export function useOwnerDashboard(shopId) {
  const [queue, setQueue]         = useState([])
  const [revenueData, setRevenue] = useState([])
  const [loading, setLoading]     = useState(true)
  const channelRef = useRef(null)

  const fetchQueue = useCallback(async () => {
    if (!shopId) return
    const { data } = await bookingsApi.getShopQueue(shopId, today())
    setQueue(data || [])
  }, [shopId])

  const fetchRevenue = useCallback(async () => {
    if (!shopId) return
    const { data } = await analytics.shopRevenue(shopId, 7)
    setRevenue(data || [])
  }, [shopId])

  useEffect(() => {
    if (!shopId) { setLoading(false); return }
    Promise.all([fetchQueue(), fetchRevenue()]).finally(() => setLoading(false))

    if (!channelRef.current) {
      channelRef.current = realtime.subscribeShopQueue(shopId, () => {
        fetchQueue()
        fetchRevenue()
      })
    }
    return () => { 
      if (channelRef.current) {
        realtime.unsubscribe(channelRef.current)
        channelRef.current = null
      }
    }
  }, [shopId, fetchQueue, fetchRevenue])

  // Aggregate stats
  const todayRevenue  = queue.filter(q => q.status === 'done').reduce((s, q) => s + (q.price || 0), 0)
  const totalToday    = queue.length
  const doneToday     = queue.filter(q => q.status === 'done').length
  const waitingCount  = queue.filter(q => q.status === 'waiting').length

  // Group revenue by day
  const dailyRevenue = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = format(d, 'yyyy-MM-dd')
    const dayRev = revenueData.filter(r => r.slot_time?.startsWith(key)).reduce((s, r) => s + (r.price || 0), 0)
    return { day: format(d, 'EEE'), rev: dayRev, date: key }
  })

  return { queue, loading, todayRevenue, totalToday, doneToday, waitingCount, dailyRevenue, refresh: fetchQueue }
}

// ── BOOKING SLOTS: available time slots for a barber ─────────────────────────
// Updated to use barber profile ID instead of barber record ID
export function useAvailableSlots(barberProfileId, date, shopHours = { opening: '09:00', closing: '19:00' }) {
  const [bookedSlots, setBooked] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Reset state if no barber or date
    if (!barberProfileId || !date) {
      setBooked([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    
    // Use profile-based method for new schema with error handling
    bookingsApi.getBookedSlotsByProfile(barberProfileId, date)
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching booked slots:', error)
          // If column doesn't exist, return empty array
          if (error.message?.includes('barber_profile_id')) {
            console.warn('barber_profile_id column not found, returning empty slots')
          }
          setBooked([])
          return
        }
        const slots = (data || []).map(b => b.slot_time?.substring(11, 16))
        setBooked(slots)
      })
      .catch(err => {
        console.error('Exception in useAvailableSlots:', err)
        setBooked([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [barberProfileId, date])

  // Parse shop hours with validation (default 9 AM to 7 PM)
  const parseHour = (timeStr, defaultHour) => {
    if (!timeStr) return defaultHour
    const hour = parseInt(timeStr.split(':')[0])
    return isNaN(hour) ? defaultHour : hour
  }
  
  const parseMinute = (timeStr) => {
    if (!timeStr) return 0
    const parts = timeStr.split(':')
    if (parts.length < 2) return 0
    const minute = parseInt(parts[1])
    return isNaN(minute) ? 0 : minute
  }

  const openHour = parseHour(shopHours.opening, 9)
  const openMinute = parseMinute(shopHours.opening)
  const closeHour = parseHour(shopHours.closing, 19)
  const closeMinute = parseMinute(shopHours.closing)

  // Generate slots based on shop operating hours, every 20 min
  const allSlots = []
  const now = new Date()
  
  // Fix: Use date string directly to avoid timezone issues
  const isToday = date === format(now, 'yyyy-MM-dd')
  
  // Start from opening time (rounded to next 20-min interval if needed)
  let startHour = openHour
  let startMinute = Math.ceil(openMinute / 20) * 20
  if (startMinute >= 60) {
    startHour++
    startMinute = 0
  }
  
  for (let h = startHour; h < closeHour || (h === closeHour && closeMinute > 0); h++) {
    const startM = (h === startHour) ? startMinute : 0
    const endM = (h === closeHour) ? closeMinute : 60
    
    for (let m = startM; m < endM; m += 20) {
      const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      let isPast = false
      
      // Filter past times if selected date is today
      if (isToday) {
        // Create date object in local timezone
        const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
        isPast = slotTime <= now
      }
      
      allSlots.push({ 
        time: t, 
        booked: bookedSlots.includes(t) || isPast 
      })
    }
  }

  return { slots: allSlots, loading }
}
