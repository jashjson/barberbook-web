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
      if (targetShopId) {
        channelRef.current = realtime.subscribeShopQueue(targetShopId, () => {
          fetchActive()
          fetchQueue(targetShopId)
        })
      }
    }

    init()
    return () => { if (channelRef.current) realtime.unsubscribe(channelRef.current) }
  }, [userId, shopId, fetchActive, fetchQueue])

  const myPosition = activeBooking
    ? queue.filter(q => q.status !== 'done' && q.status !== 'cancelled').findIndex(q => q.id === activeBooking.id) + 1
    : 0
  const ahead = Math.max(0, myPosition - 1)
  const estWait = ahead * 20 // 20 min per customer (configurable)

  return { activeBooking, queue, loading, myPosition, ahead, estWait, refresh: fetchActive }
}

// ── BARBER: today's full queue ────────────────────────────────────────────────
export function useBarberQueue(barberId) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  const fetch = useCallback(async () => {
    if (!barberId) return
    const { data, error } = await bookingsApi.getBarberQueue(barberId, today())
    if (!error) setQueue(data || [])
  }, [barberId])

  useEffect(() => {
    if (!barberId) { setLoading(false); return }
    fetch().finally(() => setLoading(false))

    channelRef.current = realtime.subscribeBarberQueue(barberId, () => fetch())
    return () => { if (channelRef.current) realtime.unsubscribe(channelRef.current) }
  }, [barberId, fetch])

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

    channelRef.current = realtime.subscribeShopQueue(shopId, () => {
      fetchQueue()
      fetchRevenue()
    })
    return () => { if (channelRef.current) realtime.unsubscribe(channelRef.current) }
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
export function useAvailableSlots(barberId, date) {
  const [bookedSlots, setBooked] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!barberId || !date) return
    setLoading(true)
    bookingsApi.getBookedSlots(barberId, date)
      .then(({ data }) => {
        setBooked((data || []).map(b => b.slot_time?.substring(11, 16)))
      })
      .finally(() => setLoading(false))
  }, [barberId, date])

  // Generate slots from 9 AM to 7 PM, every 20 min
  const allSlots = []
  for (let h = 9; h < 19; h++) {
    for (let m = 0; m < 60; m += 20) {
      const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      allSlots.push({ time: t, booked: bookedSlots.includes(t) })
    }
  }

  return { slots: allSlots, loading }
}
