import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useCustomerBooking, useAvailableSlots } from '../../hooks/useQueue'
import { bookings as bookingsApi, shops as shopsApi, barbers as barbersApi } from '../../lib/supabase'
import { profiles } from '../../lib/supabase'
import { format } from 'date-fns'
import Icon from '../../components/ui/Icon'
import { Modal, Spinner, Empty, SectionHead, StatusBadge, ConfirmDialog } from '../../components/ui/Primitives'

// ── HOME ─────────────────────────────────────────────────────────────────────
export function CustomerHome() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { activeBooking, queue, loading, ahead, estWait, refresh } = useCustomerBooking(profile?.id)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [nearbyShops, setNearbyShops] = useState([])

  useEffect(() => {
    shopsApi.getAll().then(({ data }) => setNearbyShops(data || []))
  }, [])

  const handleCancel = async () => {
    const { error } = await bookingsApi.cancel(activeBooking.id, profile.id)
    setCancelConfirm(false)
    if (error) toast('Failed to cancel booking', 'error')
    else { toast('Booking cancelled', 'default'); refresh() }
  }

  const activeQ = queue.filter(q => q.status !== 'done' && q.status !== 'cancelled')

  if (loading) return <div className="page-inner"><Spinner page /></div>

  return (
    <div className="page-inner">
      {/* Greeting */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            Hello, {profile?.name?.split(' ')[0]} 👋
          </div>
        </div>
      </div>

      {/* Active Token */}
      {activeBooking ? (
        <div className="token-hero mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: 4 }}>Your Active Token</div>
              <div className="token-num">#{String(activeBooking.token_no).padStart(2, '0')}</div>
            </div>
            <StatusBadge status={activeBooking.status} />
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {activeBooking.service} · {activeBooking.barbers?.name || 'Barber'} · {activeBooking.shops?.name}
          </div>
          <div className="token-meta-row">
            <div className="token-meta-item">
              <div className="t-val">{activeBooking.slot_time ? format(new Date(activeBooking.slot_time), 'h:mm a') : '—'}</div>
              <div className="t-key">Slot Time</div>
            </div>
            <div className="token-meta-item">
              <div className="t-val">~{estWait} min</div>
              <div className="t-key">Est. Wait</div>
            </div>
            <div className="token-meta-item">
              <div className="t-val">{ahead}</div>
              <div className="t-key">Ahead of You</div>
            </div>
          </div>
          <div className="flex gap-2 mt-4" style={{ marginTop: 18 }}>
            <button className="btn btn-danger btn-sm" onClick={() => setCancelConfirm(true)}>
              Cancel Booking
            </button>
          </div>
        </div>
      ) : (
        <div className="card card-gold-border mb-6" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✂</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No Active Booking</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 18 }}>Book a slot at your nearest barber shop and skip the wait.</div>
          <a href="/app/book" className="btn btn-gold">Book a Slot</a>
        </div>
      )}

      {/* Live Queue */}
      {activeQ.length > 0 && (
        <div className="mb-6">
          <SectionHead title="Live Queue" action={<div className="live-indicator"><div className="live-dot" />LIVE</div>} />
          <div className="card">
            {activeQ.slice(0, 6).map(q => (
              <div key={q.id} className="q-item" style={q.id === activeBooking?.id ? { background: 'rgba(201,168,76,0.04)' } : {}}>
                <div className={`q-token ${q.status === 'in_chair' ? 'active' : q.id === activeBooking?.id ? 'gold' : ''}`}>
                  {String(q.token_no).padStart(2, '0')}
                </div>
                <div className="q-info">
                  <div className="q-name" style={q.id === activeBooking?.id ? { color: 'var(--gold)' } : {}}>
                    {q.id === activeBooking?.id ? 'You' : (q.profiles?.name || `Customer #${q.token_no}`)}
                  </div>
                  <div className="q-sub">
                    {q.slot_time ? format(new Date(q.slot_time), 'h:mm a') : ''} · {q.service}
                  </div>
                </div>
                <StatusBadge status={q.status} isYou={q.id === activeBooking?.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nearby Shops */}
      <SectionHead title="Shops Near You" />
      {nearbyShops.length > 0 ? nearbyShops.slice(0, 4).map(shop => (
        <div key={shop.id} className="shop-card" onClick={() => window.location.href = '/app/book'}>
          <div className="shop-icon">✂️</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{shop.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{shop.address}</div>
            <div className="flex gap-2 mt-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {shop.barbers?.slice(0, 3).map(b => (
                <span key={b.id} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--surface-4)', borderRadius: 4, color: 'var(--text-tertiary)' }}>
                  {b.name}
                </span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span className={`badge ${shop.is_active ? 'badge-green' : 'badge-muted'}`}>
              {shop.is_active ? 'Open' : 'Closed'}
            </span>
          </div>
        </div>
      )) : (
        <Empty icon="🏪" title="No shops found" sub="Shops will appear here once they register on BarberBook." />
      )}

      {cancelConfirm && (
        <ConfirmDialog
          title="Cancel Booking?"
          body="Are you sure you want to cancel your booking? Your slot will be released for other customers."
          onConfirm={handleCancel}
          onCancel={() => setCancelConfirm(false)}
          danger
        />
      )}
    </div>
  )
}

// ── BOOK ─────────────────────────────────────────────────────────────────────
export function CustomerBook() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [allShops, setAllShops] = useState([])
  const [shopBarbers, setShopBarbers] = useState([])
  const [selectedShop, setSelectedShop]     = useState(null)
  const [selectedBarber, setSelectedBarber] = useState(null)
  const [selectedService, setSelectedSvc]   = useState(null)
  const [selectedSlot, setSelectedSlot]     = useState(null)
  const [selectedDate, setSelectedDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(null)

  const SERVICES = [
    { id: 'haircut',  label: 'Haircut',         price: 150, dur: '20 min' },
    { id: 'beard',    label: 'Beard Trim',       price: 60,  dur: '10 min' },
    { id: 'combo',    label: 'Haircut + Beard',  price: 210, dur: '30 min' },
    { id: 'style',    label: 'Full Style',       price: 180, dur: '25 min' },
    { id: 'massage',  label: 'Head Massage',     price: 80,  dur: '15 min' },
  ]

  const shopHours = selectedShop ? {
    opening: selectedShop.opening_time || '09:00:00',
    closing: selectedShop.closing_time || '19:00:00'
  } : { opening: '09:00', closing: '19:00' }
  
  const { slots, loading: slotsLoading } = useAvailableSlots(selectedBarber?.id, selectedDate, shopHours)

  useEffect(() => {
    shopsApi.getAll().then(({ data }) => setAllShops(data || []))
  }, [])

  const pickShop = async (shop) => {
    setSelectedShop(shop)
    const { data } = await barbersApi.getByShop(shop.id)
    setShopBarbers(data || [])
    setStep(2)
  }

  const confirm = async () => {
    if (!selectedShop || !selectedBarber || !selectedService || !selectedSlot) {
      toast('Please complete all selections', 'error'); return
    }
    
    // Validate booking date is not more than 14 days in advance
    const selectedDateTime = new Date(`${selectedDate}T${selectedSlot}:00`)
    const now = new Date()
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 14)
    
    if (selectedDateTime > maxDate) {
      toast('Cannot book more than 14 days in advance', 'error')
      return
    }
    
    // Validate booking is not in the past
    if (selectedDateTime <= now) {
      toast('Cannot book a time slot in the past', 'error')
      return
    }
    
    setLoading(true)
    const slotDT = `${selectedDate}T${selectedSlot}:00`
    const { data, error } = await bookingsApi.create({
      shop_id: selectedShop.id,
      barber_id: selectedBarber.id,
      user_id: profile.id,
      service: selectedService.label,
      price: selectedService.price,
      slot_time: slotDT,
    })
    setLoading(false)
    if (error) { toast(error.message || 'Booking failed', 'error'); return }
    setConfirmed(data)
    toast('Booking confirmed! 🎉', 'success')
  }

  if (confirmed) return (
    <div className="page-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <div style={{ width: 72, height: 72, background: 'var(--green-bg)', border: '1px solid rgba(61,189,125,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 36, color: 'var(--text-primary)', letterSpacing: 2, marginBottom: 6 }}>Booking Confirmed</div>
        <div className="token-hero" style={{ textAlign: 'center', margin: '20px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 4 }}>Your Token Number</div>
          <div className="token-num">#{String(confirmed.token_no).padStart(2, '0')}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            {confirmed.service} · {confirmed.barbers?.name} · {format(new Date(confirmed.slot_time), 'h:mm a')}
          </div>
        </div>
        <div className="flex gap-3">
          <a href="/app" className="btn btn-ghost flex-1">View Queue</a>
          <button className="btn btn-gold flex-1" onClick={() => { setConfirmed(null); setStep(1); setSelectedShop(null); setSelectedBarber(null); setSelectedSvc(null); setSelectedSlot(null); }}>
            Book Another
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page-inner">
      {/* Steps */}
      <div className="steps-bar">
        {['Shop', 'Barber & Service', 'Confirm'].map((label, i) => {
          const s = i + 1
          const state = step > s ? 'done' : step === s ? 'current' : 'upcoming'
          return (
            <div key={s} className="flex items-center" style={{ flex: i < 2 ? 1 : 0 }}>
              <div className="step-item">
                <div className={`step-dot ${state}`}>{state === 'done' ? <Icon name="check" size={11} /> : s}</div>
                <span className={`step-label ${state}`}>{label}</span>
              </div>
              {i < 2 && <div className={`step-line ${step > s ? 'done' : ''}`} />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Select Shop */}
      {step === 1 && (
        <div>
          <SectionHead title="Select a Shop" />
          {allShops.length === 0 ? <Empty icon="🏪" title="No shops available" sub="Check back later." /> :
            allShops.map(shop => (
              <div key={shop.id} className="shop-card" style={{ border: selectedShop?.id === shop.id ? '1px solid var(--gold)' : undefined }} onClick={() => pickShop(shop)}>
                <div className="shop-icon">✂️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{shop.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>{shop.address}</div>
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    {shop.barbers?.slice(0, 2).map(b => (
                      <span key={b.id} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--surface-4)', borderRadius: 4, color: 'var(--text-tertiary)' }}>{b.name}</span>
                    ))}
                    {(shop.barbers?.length || 0) > 2 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{shop.barbers.length - 2} more</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-green">Open</span>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Step 2: Barber + Service + Slot */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button className="btn-icon" onClick={() => setStep(1)}><Icon name="chevLeft" size={16} /></button>
            <div>
              <div style={{ fontWeight: 700 }}>{selectedShop?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selectedShop?.address}</div>
            </div>
          </div>

          <SectionHead title="Select Barber" />
          <div className="grid-2 mb-4" style={{ marginBottom: 20 }}>
            {shopBarbers.map(barber => (
              <div key={barber.id} onClick={() => setSelectedBarber(barber)} style={{
                padding: '14px 16px', borderRadius: 'var(--radius)', cursor: 'pointer',
                border: selectedBarber?.id === barber.id ? '1px solid var(--gold)' : '1px solid var(--outline)',
                background: selectedBarber?.id === barber.id ? 'var(--gold-bg)' : 'var(--surface-2)',
                transition: 'var(--transition)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="avatar avatar-md av-blue">{barber.name?.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{barber.name}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      <span className={`badge ${barber.is_available ? 'badge-green' : 'badge-muted'}`}>
                        {barber.is_available ? 'Available' : 'Busy'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <SectionHead title="Select Service" />
          <div className="grid-2 mb-4" style={{ marginBottom: 20 }}>
            {SERVICES.map(sv => (
              <div key={sv.id} onClick={() => setSelectedSvc(sv)} style={{
                padding: '14px', borderRadius: 'var(--radius)', cursor: 'pointer',
                border: selectedService?.id === sv.id ? '1px solid var(--gold)' : '1px solid var(--outline)',
                background: selectedService?.id === sv.id ? 'var(--gold-bg)' : 'var(--surface-2)',
                transition: 'var(--transition)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{sv.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sv.dur}</div>
                <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'var(--gold)', marginTop: 8 }}>₹{sv.price}</div>
              </div>
            ))}
          </div>

          <SectionHead title="Select Date & Time" />
          <div className="form-field mb-4">
            <input 
              type="date" 
              className="form-input" 
              value={selectedDate} 
              min={format(new Date(), 'yyyy-MM-dd')} 
              max={format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
              onChange={e => setSelectedDate(e.target.value)} 
            />
          </div>
          {slotsLoading ? <Spinner /> : (
            <div className="slot-grid mb-6" style={{ marginBottom: 20 }}>
              {slots.map(sl => (
                <div key={sl.time} className={`slot ${sl.booked ? 'booked' : ''} ${selectedSlot === sl.time ? 'selected' : ''}`} onClick={() => !sl.booked && setSelectedSlot(sl.time)}>
                  {sl.time}
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-gold btn-full btn-lg" disabled={!selectedBarber || !selectedService || !selectedSlot} onClick={() => setStep(3)}>
            Review Booking <Icon name="chevRight" size={15} />
          </button>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button className="btn-icon" onClick={() => setStep(2)}><Icon name="chevLeft" size={16} /></button>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Review & Confirm</div>
          </div>
          <div className="card card-gold-border mb-6" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700, marginBottom: 14 }}>Booking Summary</div>
            {[
              ['Shop',     selectedShop?.name],
              ['Barber',   selectedBarber?.name],
              ['Service',  selectedService?.label],
              ['Date',     format(new Date(selectedDate), 'EEEE, d MMMM yyyy')],
              ['Time',     selectedSlot],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--outline)', fontSize: 14 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div className="flex justify-between" style={{ padding: '14px 0 0', fontSize: 18, fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--gold)', fontFamily: 'Bebas Neue', fontSize: 26 }}>₹{selectedService?.price}</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 16 }}>
            Pay at the shop · Free cancellation any time before your slot
          </div>
          <button className="btn btn-gold btn-full btn-xl" disabled={loading} onClick={confirm}>
            {loading ? <Spinner /> : <Icon name="check" size={16} />}
            {loading ? 'Confirming…' : 'Confirm Booking'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── HISTORY ──────────────────────────────────────────────────────────────────
export function CustomerHistory() {
  const { profile } = useAuth()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    bookingsApi.getUserBookings(profile.id)
      .then(({ data }) => setHistory(data || []))
      .finally(() => setLoading(false))
  }, [profile])

  const total = history.filter(b => b.status === 'done').reduce((s, b) => s + (b.price || 0), 0)
  const done  = history.filter(b => b.status === 'done').length

  if (loading) return <div className="page-inner"><Spinner page /></div>

  return (
    <div className="page-inner">
      <div className="stat-grid">
        <div className="card stat-card card-pad"><div className="stat-val">{history.length}</div><div className="stat-label">Total Bookings</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">{done}</div><div className="stat-label">Completed</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">₹{total.toLocaleString()}</div><div className="stat-label">Total Spent</div></div>
      </div>

      <SectionHead title="Booking History" />
      <div className="card">
        {history.length === 0 ? (
          <Empty icon="📋" title="No bookings yet" sub="Your booking history will appear here." />
        ) : history.map(b => (
          <div key={b.id} className="q-item">
            <div className={`q-token ${b.status === 'done' ? 'gold' : ''}`}>{String(b.token_no || '—').padStart(2, '0')}</div>
            <div className="q-info">
              <div className="q-name">{b.shops?.name || 'Unknown Shop'}</div>
              <div className="q-sub">
                {b.service} · {b.barbers?.name || 'Barber'} · {b.slot_time ? format(new Date(b.slot_time), 'd MMM, h:mm a') : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: 'var(--gold)' }}>₹{b.price || '—'}</div>
              <StatusBadge status={b.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PROFILE ──────────────────────────────────────────────────────────────────
export function CustomerProfile() {
  const { profile, signOut, updateProfile } = useAuth()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.name || '')
  const [loading, setLoading] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setLoading(true)
    await updateProfile({ name: name.trim(), initials: name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) })
    setLoading(false)
    setEditing(false)
    toast('Profile updated', 'success')
  }

  return (
    <div className="page-inner">
      {/* Avatar block */}
      <div className="card card-pad" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="avatar avatar-xl av-gold" style={{ margin: '0 auto 14px', border: '3px solid rgba(201,168,76,0.25)' }}>
          {profile?.initials || '??'}
        </div>
        {editing ? (
          <div style={{ display: 'flex', gap: 8, maxWidth: 280, margin: '0 auto 12px' }}>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
            <button className="btn btn-gold btn-sm" onClick={save} disabled={loading}>{loading ? <Spinner /> : 'Save'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
          </div>
        ) : (
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{profile?.name}</div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{profile?.email}</div>
        {profile?.phone && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>{profile?.phone}</div>}
        <span className="badge badge-gold">Customer</span>
        {!editing && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} style={{ marginLeft: 10 }}><Icon name="edit" size={13} />Edit Name</button>}
      </div>

      <div className="card">
        {[
          { icon: 'history', label: 'Booking History', sub: 'View all past bookings', href: '/app/history' },
          { icon: 'phone',   label: 'Phone Number',    sub: profile?.phone || 'Not set' },
          { icon: 'info',    label: 'Help & Support',  sub: 'Contact us at hello@barberbook.in' },
        ].map((item, i) => (
          <div key={i} className="menu-item"
            onClick={() => item.href ? (window.location.href = item.href) : null}
            style={item.href ? {} : { cursor: 'default' }}
          >
            <div className="menu-item-icon"><Icon name={item.icon} size={16} color="var(--gold)" /></div>
            <div className="menu-item-text">
              <div className="menu-item-label">{item.label}</div>
              <div className="menu-item-sub">{item.sub}</div>
            </div>
            {item.href && <Icon name="chevRight" size={14} color="var(--text-tertiary)" />}
          </div>
        ))}
        <div className="menu-item" onClick={signOut}>
          <div className="menu-item-icon danger"><Icon name="logout" size={16} color="var(--red)" /></div>
          <div className="menu-item-text">
            <div className="menu-item-label danger">Sign Out</div>
            <div className="menu-item-sub">You'll need to log back in</div>
          </div>
        </div>
      </div>
    </div>
  )
}
