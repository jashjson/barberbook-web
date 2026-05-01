import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useBarberQueue } from '../../hooks/useQueue'
import { bookings as bookingsApi, barbers as barbersApi, shopBarbers as shopBarbersApi, analytics } from '../../lib/supabase'
import { format, startOfDay } from 'date-fns'
import Icon from '../../components/ui/Icon'
import { Spinner, Empty, SectionHead, StatusBadge, Toggle, Modal } from '../../components/ui/Primitives'

function useBarberProfile(profileId) {
  const [barber, setBarber] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!profileId) return
    barbersApi.getByProfile(profileId).then(({ data }) => { setBarber(data); setLoading(false) })
  }, [profileId])
  return { barber, loading, refresh: () => barbersApi.getByProfile(profileId).then(({ data }) => setBarber(data)) }
}

// ── QUEUE ─────────────────────────────────────────────────────────────────────
export function BarberQueue() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { barber } = useBarberProfile(profile?.id)
  const { queue, current, waiting, done, loading, refresh } = useBarberQueue(barber?.id)
  const [editingBooking, setEditingBooking] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ slot_time: '', service: '', notes: '' })

  const updateStatus = async (id, status) => {
    const { error } = await bookingsApi.updateStatus(id, status)
    if (error) toast('Failed to update status', 'error')
    else { toast(status === 'done' ? '✓ Marked as done' : 'Status updated', 'success'); refresh() }
  }

  const openEditModal = (booking) => {
    setEditingBooking(booking)
    const slotDateTime = new Date(booking.slot_time)
    const timeStr = format(slotDateTime, 'HH:mm')
    const dateStr = format(slotDateTime, 'yyyy-MM-dd')
    setEditForm({
      slot_date: dateStr,
      slot_time: timeStr,
      service: booking.service,
      notes: booking.notes || ''
    })
    setShowEditModal(true)
  }

  const saveEdit = async () => {
    if (!editingBooking) return
    
    // Validate new date/time
    const newSlotTime = `${editForm.slot_date}T${editForm.slot_time}:00`
    const newDateTime = new Date(newSlotTime)
    const now = new Date()
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 14)
    
    // Check if new time is in the past
    if (newDateTime <= now) {
      toast('Cannot reschedule to a past time', 'error')
      return
    }
    
    // Check if new time is beyond 14 days
    if (newDateTime > maxDate) {
      toast('Cannot reschedule beyond 14 days', 'error')
      return
    }
    
    const { error } = await bookingsApi.update(editingBooking.id, {
      slot_time: newSlotTime,
      service: editForm.service,
      notes: editForm.notes
    })
    if (error) toast('Failed to update booking', 'error')
    else {
      toast('Booking updated successfully', 'success')
      setShowEditModal(false)
      refresh()
    }
  }

  const cancelBooking = async (id, customerName) => {
    if (!confirm(`Cancel booking for ${customerName}?`)) return
    const { error } = await bookingsApi.cancelByBarber(id)
    if (error) toast('Failed to cancel booking', 'error')
    else {
      toast('Booking cancelled', 'default')
      refresh()
    }
  }

  if (loading) return <div className="page-inner"><Spinner page /></div>
  if (!barber) return (
    <div className="page-inner">
      <Empty icon="✂" title="Not set up as barber" sub="Your profile isn't linked to a barbershop yet. Contact your shop owner." />
    </div>
  )

  return (
    <div className="page-inner">
      {/* Stats */}
      <div className="stat-grid">
        <div className="card stat-card card-pad"><div className="stat-val">{queue.length}</div><div className="stat-label">Total Today</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">{done.length}</div><div className="stat-label">Done</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">{waiting.length}</div><div className="stat-label">Waiting</div></div>
        <div className="card stat-card card-pad">
          <div className="stat-val">₹{done.reduce((s,q) => s+(q.price||0), 0).toLocaleString()}</div>
          <div className="stat-label">Earned Today</div>
        </div>
      </div>

      {/* In Chair */}
      {current && (
        <>
          <SectionHead title="In Chair Now" />
          <div className="card" style={{ borderColor: 'rgba(224,86,86,0.25)', background: 'rgba(224,86,86,0.02)', marginBottom: 16 }}>
            <div className="card-pad">
              <div className="flex items-center gap-3">
                <div className="q-token active" style={{ width: 50, height: 50, fontSize: 22 }}>
                  {String(current.token_no).padStart(2, '0')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{current.profiles?.name || `Token #${current.token_no}`}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {current.service} · {current.slot_time ? format(new Date(current.slot_time), 'h:mm a') : ''}
                  </div>
                  {current.profiles?.phone && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>📱 {current.profiles.phone}</div>}
                </div>
                <span className="badge badge-red">In Chair</span>
              </div>
              <div className="flex gap-2 mt-4" style={{ marginTop: 14 }}>
                <button className="btn btn-success flex-1" onClick={() => updateStatus(current.id, 'done')}>
                  <Icon name="check" size={14} /> Done
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { updateStatus(current.id, 'waiting'); toast('Moved back to waiting') }}>
                  <Icon name="skip" size={14} /> Skip
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Waiting */}
      <SectionHead
        title={`Waiting Queue`}
        action={<div className="live-indicator"><div className="live-dot"/>LIVE · {waiting.length} left</div>}
      />
      <div className="card">
        {waiting.length === 0 ? (
          <Empty icon="🎉" title="Queue is empty" sub="No one waiting. Enjoy the break!" />
        ) : waiting.map((q, i) => (
          <div key={q.id} className="q-item">
            <div className={`q-token ${i === 0 ? 'gold' : ''}`}>{String(q.token_no).padStart(2, '0')}</div>
            <div className="q-info">
              <div className="q-name">{q.profiles?.name || `Customer #${q.token_no}`}</div>
              <div className="q-sub">{q.service} · {q.slot_time ? format(new Date(q.slot_time), 'h:mm a') : ''}</div>
            </div>
            <div className="flex gap-2">
              {i === 0 && !current && (
                <button className="btn btn-gold btn-sm" onClick={() => updateStatus(q.id, 'in_chair')}>
                  Call Next
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(q)}>
                <Icon name="edit" size={13} />
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => cancelBooking(q.id, q.profiles?.name || 'Customer')}>
                <Icon name="x" size={13} />
              </button>
              <span className="badge badge-amber">#{i + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingBooking && (
        <Modal title="Edit Appointment" onClose={() => setShowEditModal(false)}>
          <div className="form-field">
            <label className="form-label">Customer</label>
            <input className="form-input" value={editingBooking.profiles?.name || 'Customer'} disabled />
          </div>
          <div className="form-field">
            <label className="form-label">Service</label>
            <input 
              className="form-input" 
              value={editForm.service} 
              onChange={e => setEditForm(f => ({ ...f, service: e.target.value }))} 
            />
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-field">
              <label className="form-label">Date</label>
              <input 
                className="form-input" 
                type="date" 
                value={editForm.slot_date} 
                min={format(new Date(), 'yyyy-MM-dd')}
                max={format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}
                onChange={e => setEditForm(f => ({ ...f, slot_date: e.target.value }))} 
              />
            </div>
            <div className="form-field">
              <label className="form-label">Time</label>
              <input 
                className="form-input" 
                type="time" 
                value={editForm.slot_time} 
                onChange={e => setEditForm(f => ({ ...f, slot_time: e.target.value }))} 
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Notes (Optional)</label>
            <textarea 
              className="form-input" 
              rows={3}
              value={editForm.notes} 
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} 
              placeholder="Add any special notes..."
            />
          </div>
          <div className="flex gap-3 mt-4" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost flex-1" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button className="btn btn-gold flex-1" onClick={saveEdit}>
              <Icon name="check" size={14} /> Save Changes
            </button>
          </div>
        </Modal>
      )}

      {/* Done today */}
      {done.length > 0 && (
        <>
          <SectionHead title={`Completed Today (${done.length})`} />
          <div className="card">
            {done.map(q => (
              <div key={q.id} className="q-item" style={{ opacity: 0.6 }}>
                <div className="q-token">{String(q.token_no).padStart(2, '0')}</div>
                <div className="q-info">
                  <div className="q-name">{q.profiles?.name || `Token #${q.token_no}`}</div>
                  <div className="q-sub">{q.service} · ₹{q.price}</div>
                </div>
                <span className="badge badge-muted">Done</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────
export function BarberSchedule() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { barber, refresh } = useBarberProfile(profile?.id)
  const { queue } = useBarberQueue(barber?.id)
  const [avail, setAvail] = useState({ bookings: true, walkIns: true, onBreak: false })

  const toggleAvail = async (key) => {
    const next = { ...avail, [key]: !avail[key] }
    setAvail(next)
    if (barber) {
      await barbersApi.update(barber.id, { is_available: !next.onBreak && next.bookings })
      toast('Availability updated')
    }
  }

  const statusMap = { done: 'badge-muted', in_chair: 'badge-red', waiting: 'badge-amber', cancelled: 'badge-muted' }

  return (
    <div className="page-inner">
      <SectionHead title="Today's Schedule" />
      <div className="card mb-6" style={{ marginBottom: 20 }}>
        {queue.length === 0 ? (
          <Empty icon="📅" title="No bookings today" sub="Your schedule is clear." />
        ) : queue.map(q => (
          <div key={q.id} className="q-item">
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 48, flexShrink: 0 }}>
              {q.slot_time ? format(new Date(q.slot_time), 'h:mm a') : '—'}
            </div>
            <div className="q-info">
              <div className="q-name">{q.profiles?.name || `Token #${q.token_no}`}</div>
              <div className="q-sub">{q.service}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--gold)' }}>₹{q.price}</div>
              <span className={`badge ${statusMap[q.status] || 'badge-muted'}`} style={{ marginTop: 3 }}>
                {q.status === 'in_chair' ? 'In Chair' : q.status?.charAt(0).toUpperCase() + q.status?.slice(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <SectionHead title="Availability Settings" />
      <div className="card card-pad">
        {[
          { k: 'bookings', l: 'Accept new bookings', s: 'Allow customers to book your slots' },
          { k: 'walkIns',  l: 'Accept walk-ins',      s: 'Welcome unscheduled customers' },
          { k: 'onBreak',  l: 'Go on break',           s: 'Temporarily pause all requests' },
        ].map(item => (
          <div key={item.k} className="toggle-row">
            <div>
              <div className="toggle-row-label">{item.l}</div>
              <div className="toggle-row-sub">{item.s}</div>
            </div>
            <Toggle on={avail[item.k]} onToggle={() => toggleAvail(item.k)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── EARNINGS ─────────────────────────────────────────────────────────────────
export function BarberEarnings() {
  const { profile } = useAuth()
  const { barber } = useBarberProfile(profile?.id)
  const { done } = useBarberQueue(barber?.id)
  const [weekData, setWeekData] = useState([])

  useEffect(() => {
    if (!barber?.id) return
    // Fetch real earnings data for the past 7 days
    const from = new Date()
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
    analytics.barberStats(barber.id, format(from, 'yyyy-MM-dd')).then(({ data }) => {
      const rows = data || []
      const arr = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i))
        const key = format(d, 'yyyy-MM-dd')
        const dayRevenue = rows
          .filter(r => r.status === 'done' && r.slot_time?.startsWith(key))
          .reduce((s, r) => s + (r.price || 0), 0)
        return { day: format(d, 'EEE'), rev: dayRevenue }
      })
      setWeekData(arr)
    })
  }, [barber])

  const todayRev = done.reduce((s, q) => s + (q.price || 0), 0)
  const maxRev = Math.max(...weekData.map(d => d.rev), 1)

  return (
    <div className="page-inner">
      <div className="stat-grid">
        <div className="card stat-card card-pad"><div className="stat-val">₹{todayRev.toLocaleString()}</div><div className="stat-label">Today</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">{done.length}</div><div className="stat-label">Cuts Today</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">₹{(todayRev * 26).toLocaleString()}</div><div className="stat-label">Est. Monthly</div></div>
      </div>

      <SectionHead title="Weekly Revenue" />
      <div className="card card-pad mb-6" style={{ marginBottom: 20 }}>
        <div className="bar-chart" style={{ height: 130 }}>
          {weekData.map(d => (
            <div key={d.day} className="bar-col">
              <div className="bar-val">₹{(d.rev/1000).toFixed(1)}k</div>
              <div className="bar-fill" style={{ height: `${Math.round(d.rev / maxRev * 100)}%`, background: d.day === format(new Date(), 'EEE') ? 'var(--gold)' : 'rgba(201,168,76,0.28)' }} />
              <div className="bar-lbl">{d.day}</div>
            </div>
          ))}
        </div>
      </div>

      <SectionHead title="Today's Completed Jobs" />
      <div className="card">
        {done.length === 0 ? (
          <Empty icon="💰" title="No completed jobs yet" sub="Completed bookings will appear here." />
        ) : done.map(q => (
          <div key={q.id} className="q-item">
            <div className="q-token gold">{String(q.token_no).padStart(2, '0')}</div>
            <div className="q-info">
              <div className="q-name">{q.profiles?.name || `Token #${q.token_no}`}</div>
              <div className="q-sub">{q.service}</div>
            </div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: 'var(--gold)' }}>₹{q.price}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── BARBER PROFILE ────────────────────────────────────────────────────────────
export function BarberProfile() {
  const { profile, signOut, updateProfile } = useAuth()
  const { barber } = useBarberProfile(profile?.id)
  const { toast } = useToast()
  const [pendingInvites, setPendingInvites] = useState([])
  const [myShops, setMyShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(null)

  // Fetch shop links and pending invites
  useEffect(() => {
    if (!profile?.id) return
    setLoading(true)
    Promise.all([
      shopBarbersApi.getPendingForBarber(profile.id),
      shopBarbersApi.getByBarber(profile.id)
    ]).then(([pendingRes, allRes]) => {
      setPendingInvites(pendingRes.data || [])
      setMyShops((allRes.data || []).filter(l => l.status === 'active'))
      setLoading(false)
    })
  }, [profile?.id])

  const handleInvite = async (linkId, action) => {
    setResponding(linkId)
    const { error } = action === 'accept' 
      ? await shopBarbersApi.acceptInvite(linkId)
      : await shopBarbersApi.rejectInvite(linkId)
    setResponding(null)
    
    if (error) {
      toast(`Failed to ${action} invite`, 'error')
    } else {
      toast(action === 'accept' ? 'Invite accepted!' : 'Invite rejected', 'success')
      // Refresh lists
      Promise.all([
        shopBarbersApi.getPendingForBarber(profile.id),
        shopBarbersApi.getByBarber(profile.id)
      ]).then(([pendingRes, allRes]) => {
        setPendingInvites(pendingRes.data || [])
        setMyShops((allRes.data || []).filter(l => l.status === 'active'))
      })
    }
  }

  return (
    <div className="page-inner">
      <div className="card card-pad" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="avatar avatar-xl av-blue" style={{ margin: '0 auto 14px', border: '3px solid rgba(74,158,224,0.25)' }}>
          {profile?.initials || '??'}
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{profile?.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          {barber?.shops?.name || (myShops.length > 0 ? myShops[0].shops.name : 'No shop assigned')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>{profile?.email}</div>
        <span className="badge badge-blue">Barber</span>
      </div>

      {/* Pending Invites */}
      {!loading && pendingInvites.length > 0 && (
        <>
          <SectionHead title="Shop Invitations" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {pendingInvites.map(invite => (
              <div key={invite.id} className="card card-pad" style={{ borderColor: 'var(--gold-bdr)', background: 'var(--gold-bg)' }}>
                <div className="flex items-center gap-3 mb-3" style={{ marginBottom: 12 }}>
                  <div className="avatar avatar-md av-gold">
                    <Icon name="store" size={18} color="var(--gold)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{invite.shops.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {invite.shops.address || 'No address'} · Invited by {invite.shops.profiles?.name}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    className="btn btn-gold flex-1" 
                    onClick={() => handleInvite(invite.id, 'accept')}
                    disabled={responding === invite.id}
                  >
                    {responding === invite.id ? <Spinner /> : <Icon name="check" size={14} />}
                    Accept
                  </button>
                  <button 
                    className="btn btn-ghost flex-1" 
                    onClick={() => handleInvite(invite.id, 'reject')}
                    disabled={responding === invite.id}
                  >
                    <Icon name="x" size={14} /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* My Shops */}
      {!loading && myShops.length > 0 && (
        <>
          <SectionHead title="My Shops" />
          <div className="card" style={{ marginBottom: 16 }}>
            {myShops.map(link => (
              <div key={link.id} className="menu-item" style={{ cursor: 'default' }}>
                <div className="menu-item-icon"><Icon name="store" size={16} color="var(--blue)" /></div>
                <div className="menu-item-text">
                  <div className="menu-item-label">{link.shops.name}</div>
                  <div className="menu-item-sub">{link.shops.address || 'No address'}</div>
                </div>
                <span className="badge badge-green">Active</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        {[
          { icon: 'phone', label: 'Phone',          sub: profile?.phone || 'Not set' },
          { icon: 'info',  label: 'Help & Support', sub: 'Contact us at hello@barberbook.in' },
        ].map((item, i) => (
          <div key={i} className="menu-item" style={{ cursor: 'default' }}>
            <div className="menu-item-icon"><Icon name={item.icon} size={16} color="var(--blue)" /></div>
            <div className="menu-item-text">
              <div className="menu-item-label">{item.label}</div>
              <div className="menu-item-sub">{item.sub}</div>
            </div>
          </div>
        ))}
        <div className="menu-item" onClick={signOut}>
          <div className="menu-item-icon danger"><Icon name="logout" size={16} color="var(--red)" /></div>
          <div className="menu-item-text">
            <div className="menu-item-label danger">Sign Out</div>
          </div>
        </div>
      </div>
    </div>
  )
}
