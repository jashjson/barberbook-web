import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useBarberQueue } from '../../hooks/useQueue'
import { bookings as bookingsApi, barbers as barbersApi, analytics } from '../../lib/supabase'
import { format, startOfDay } from 'date-fns'
import Icon from '../../components/ui/Icon'
import { Spinner, Empty, SectionHead, StatusBadge, Toggle } from '../../components/ui/Primitives'

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

  const updateStatus = async (id, status) => {
    const { error } = await bookingsApi.updateStatus(id, status)
    if (error) toast('Failed to update status', 'error')
    else { toast(status === 'done' ? '✓ Marked as done' : 'Status updated', 'success'); refresh() }
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
              <span className="badge badge-amber">#{i + 1}</span>
            </div>
          </div>
        ))}
      </div>

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

  return (
    <div className="page-inner">
      <div className="card card-pad" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="avatar avatar-xl av-blue" style={{ margin: '0 auto 14px', border: '3px solid rgba(74,158,224,0.25)' }}>
          {profile?.initials || '??'}
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{profile?.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          ✂ Barber · {barber?.shops?.name || 'Unassigned'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>{profile?.email}</div>
        <span className="badge badge-blue">Barber</span>
      </div>

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
