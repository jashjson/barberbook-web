import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useOwnerDashboard } from '../../hooks/useQueue'
import { shops as shopsApi, barbers as barbersApi, shopBarbers as shopBarbersApi } from '../../lib/supabase'
import { format } from 'date-fns'
import Icon from '../../components/ui/Icon'
import { Spinner, Empty, SectionHead, StatusBadge, Toggle, Modal } from '../../components/ui/Primitives'

function useOwnerShop(ownerId) {
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const fetch = () => {
    if (!ownerId) return
    shopsApi.getByOwner(ownerId).then(({ data }) => { setShop(data?.[0] || null); setLoading(false) })
  }
  useEffect(fetch, [ownerId])
  return { shop, loading, refresh: fetch }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export function OwnerDashboard() {
  const { profile } = useAuth()
  const { shop } = useOwnerShop(profile?.id)
  const { queue, loading, todayRevenue, totalToday, doneToday, waitingCount, dailyRevenue } = useOwnerDashboard(shop?.id)
  const maxRev = Math.max(...dailyRevenue.map(d => d.rev), 1)

  if (loading) return <div className="page-inner"><Spinner page /></div>
  if (!shop) return (
    <div className="page-inner">
      <Empty icon="🏪" title="No shop set up yet" sub="Go to 'My Shop' to create your barber shop listing." action={<a href="/app/shop" className="btn btn-gold">Set Up My Shop</a>} />
    </div>
  )

  const peakHours = ['9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM']
  const peakHeights = [20, 45, 88, 100, 82, 60, 55, 72, 66, 38]

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{shop.name}</div>
        </div>
        <div className="live-indicator"><div className="live-dot" /> LIVE</div>
      </div>

      <div className="stat-grid">
        <div className="card stat-card card-pad" style={{ borderColor: 'var(--gold-bdr)' }}>
          <div className="stat-val">₹{todayRevenue.toLocaleString()}</div>
          <div className="stat-label">Today's Revenue</div>
        </div>
        <div className="card stat-card card-pad"><div className="stat-val">{totalToday}</div><div className="stat-label">Bookings</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">{doneToday}</div><div className="stat-label">Completed</div></div>
        <div className="card stat-card card-pad"><div className="stat-val">{waitingCount}</div><div className="stat-label">Waiting Now</div></div>
      </div>

      <div className="grid-2">
        {/* Revenue chart */}
        <div className="card card-pad">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 18 }}>Weekly Revenue</div>
          <div className="bar-chart" style={{ height: 120 }}>
            {dailyRevenue.map(d => (
              <div key={d.day} className="bar-col">
                <div className="bar-val">₹{(d.rev / 1000).toFixed(1)}k</div>
                <div className="bar-fill" style={{ height: `${Math.round(d.rev / maxRev * 100)}%`, background: d.day === format(new Date(), 'EEE') ? 'var(--gold)' : 'rgba(201,168,76,0.25)' }} />
                <div className="bar-lbl">{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff */}
        <div className="card card-pad">
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Staff Today</div>
          {shop.barbers?.length === 0 ? (
            <Empty icon="✂" title="No barbers added" sub="Add staff in the My Shop section." />
          ) : shop.barbers?.map(b => {
            const barberBookings = queue.filter(q => q.barber_id === b.id)
            const barberDone = barberBookings.filter(q => q.status === 'done')
            const barberRev = barberDone.reduce((s, q) => s + (q.price || 0), 0)
            return (
              <div key={b.id} style={{ marginBottom: 14 }}>
                <div className="flex justify-between mb-2" style={{ marginBottom: 8 }}>
                  <div className="flex items-center gap-2">
                    <div className="avatar avatar-sm av-blue">{b.name?.slice(0,2).toUpperCase()}</div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                  </div>
                  <div>
                    <span style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--gold)' }}>₹{barberRev.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>{barberDone.length} cuts</span>
                  </div>
                </div>
                <div className="progress">
                  <div className="progress-fill progress-gold" style={{ width: `${Math.round((barberDone.length / Math.max(barberBookings.length, 1)) * 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Peak hours */}
      <SectionHead title="Peak Hours Today" />
      <div className="card card-pad">
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {peakHours.map((h, i) => (
            <div key={h} className="bar-col" style={{ flex: 1 }}>
              <div className="bar-fill" style={{ height: `${peakHeights[i]}%`, background: peakHeights[i] >= 80 ? 'var(--gold)' : 'rgba(201,168,76,0.2)', borderRadius: '3px 3px 0 0', width: '100%', minHeight: 3 }} />
              <div className="bar-lbl">{h}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── BOOKINGS ──────────────────────────────────────────────────────────────────
export function OwnerBookings() {
  const { profile } = useAuth()
  const { shop } = useOwnerShop(profile?.id)
  const { queue, loading } = useOwnerDashboard(shop?.id)
  const [filter, setFilter] = useState('all')

  const filters = ['all', 'waiting', 'in_chair', 'done', 'cancelled']
  const filtered = filter === 'all' ? queue : queue.filter(q => q.status === filter)
  const totalFiltered = filtered.reduce((s, q) => s + (q.price || 0), 0)

  if (loading) return <div className="page-inner"><Spinner page /></div>

  return (
    <div className="page-inner">
      <div className="flex items-center gap-2 mb-6" style={{ flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-gold' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'in_chair' ? 'In Chair' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: 'Bebas Neue', fontSize: 22, color: 'var(--gold)' }}>
          ₹{totalFiltered.toLocaleString()}
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <Empty icon="📋" title="No bookings found" />
        ) : filtered.map(q => (
          <div key={q.id} className="q-item">
            <div className={`q-token ${q.status === 'in_chair' ? 'active' : q.status === 'done' ? 'gold' : ''}`}>
              {String(q.token_no).padStart(2, '0')}
            </div>
            <div className="q-info">
              <div className="q-name">
                {q.profiles?.name || `Customer #${q.token_no}`}
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 8 }}>→ {q.barbers?.name}</span>
              </div>
              <div className="q-sub">
                {q.service} · {q.slot_time ? format(new Date(q.slot_time), 'h:mm a') : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: 'var(--gold)' }}>₹{q.price || '—'}</div>
              <StatusBadge status={q.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── STAFF ─────────────────────────────────────────────────────────────────────
export function OwnerStaff() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const { shop, refresh } = useOwnerShop(profile?.id)
  const [showInvite, setShowInvite] = useState(false)
  const [barberEmail, setBarberEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [barberLinks, setBarberLinks] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch barber links
  useEffect(() => {
    if (!shop?.id) return
    setLoading(true)
    shopBarbersApi.getByShop(shop.id).then(({ data }) => {
      setBarberLinks(data || [])
      setLoading(false)
    })
  }, [shop?.id])

  const inviteBarber = async () => {
    if (!barberEmail.trim() || !shop) return
    setInviting(true)
    const { data, error } = await shopBarbersApi.inviteBarber(shop.id, barberEmail.trim(), profile.id)
    setInviting(false)
    if (error) {
      toast(error.message || 'Failed to invite barber', 'error')
    } else {
      toast(`Invite sent to ${data.profiles.name}!`, 'success')
      setShowInvite(false)
      setBarberEmail('')
      // Refresh the list
      shopBarbersApi.getByShop(shop.id).then(({ data }) => setBarberLinks(data || []))
    }
  }

  const toggleAvailability = async (linkId, current) => {
    const { error } = await shopBarbersApi.setAvailability(linkId, !current)
    if (!error) {
      shopBarbersApi.getByShop(shop.id).then(({ data }) => setBarberLinks(data || []))
      toast('Availability updated')
    }
  }

  const removeBarber = async (linkId, barberName) => {
    if (!confirm(`Remove ${barberName} from your shop?`)) return
    const { error } = await shopBarbersApi.removeBarber(linkId)
    if (error) toast('Failed to remove barber', 'error')
    else {
      toast('Barber removed', 'default')
      shopBarbersApi.getByShop(shop.id).then(({ data }) => setBarberLinks(data || []))
    }
  }

  const deleteInvite = async (linkId) => {
    const { error } = await shopBarbersApi.deleteInvite(linkId)
    if (error) toast('Failed to cancel invite', 'error')
    else {
      toast('Invite cancelled', 'default')
      shopBarbersApi.getByShop(shop.id).then(({ data }) => setBarberLinks(data || []))
    }
  }

  const activeBarbers = barberLinks.filter(l => l.status === 'active')
  const pendingInvites = barberLinks.filter(l => l.status === 'pending')

  if (loading) return <div className="page-inner"><Spinner page /></div>

  return (
    <div className="page-inner">
      <div className="flex items-center justify-between mb-6">
        <div style={{ fontWeight: 700, fontSize: 18 }}>Staff Management</div>
        <button className="btn btn-gold btn-sm" onClick={() => setShowInvite(true)}>
          <Icon name="mail" size={13} /> Invite Barber
        </button>
      </div>

      {!shop ? (
        <Empty icon={<Icon name="store" size={32} color="var(--text-tertiary)" />} title="Set up your shop first" sub="Create your shop in 'My Shop' before managing staff." />
      ) : (
        <>
          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <>
              <SectionHead title="Pending Invites" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {pendingInvites.map(link => (
                  <div key={link.id} className="card card-pad">
                    <div className="flex items-center gap-3">
                      <div className="avatar avatar-md av-muted">
                        <Icon name="clock" size={18} color="var(--text-tertiary)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{link.profiles.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {link.profiles.email} · Invited {format(new Date(link.invited_at), 'MMM d')}
                        </div>
                      </div>
                      <span className="badge badge-amber">Pending</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteInvite(link.id)}>
                        <Icon name="x" size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Active Barbers */}
          {activeBarbers.length === 0 && pendingInvites.length === 0 ? (
            <Empty 
              icon={<Icon name="scissors" size={32} color="var(--text-tertiary)" />} 
              title="No barbers yet" 
              sub="Invite barbers who have BarberBook accounts to join your shop." 
              action={<button className="btn btn-gold" onClick={() => setShowInvite(true)}>Invite First Barber</button>} 
            />
          ) : activeBarbers.length > 0 ? (
            <>
              <SectionHead title="Active Barbers" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeBarbers.map(link => (
                  <div key={link.id} className="card card-pad card-hover">
                    <div className="flex items-center gap-3 mb-4" style={{ marginBottom: 14 }}>
                      <div className="avatar avatar-lg av-blue">
                        {link.profiles.name?.slice(0,2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{link.profiles.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {link.profiles.email}
                          {link.profiles.phone && ` · ${link.profiles.phone}`}
                        </div>
                      </div>
                      <span className={`badge ${link.is_available ? 'badge-green' : 'badge-muted'}`}>
                        {link.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="divider" />
                    <div className="flex items-center justify-between" style={{ paddingTop: 12 }}>
                      <div className="toggle-row" style={{ flex: 1, padding: 0 }}>
                        <div className="toggle-row-label" style={{ fontSize: 13 }}>Available Today</div>
                        <Toggle on={link.is_available} onToggle={() => toggleAvailability(link.id, link.is_available)} />
                      </div>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: 'var(--red)' }}
                        onClick={() => removeBarber(link.id, link.profiles.name)}
                      >
                        <Icon name="trash" size={14} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {showInvite && (
        <Modal title="Invite Barber to Your Shop" onClose={() => setShowInvite(false)}>
          <div style={{ background: 'var(--blue-bg)', border: '1px solid rgba(86,156,224,0.25)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 12, color: 'var(--blue)', marginBottom: 16, lineHeight: 1.5 }}>
            <Icon name="info" size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            The barber must already have a BarberBook account with role "Barber". They'll receive a notification to accept your invite.
          </div>
          <div className="form-field">
            <label className="form-label">Barber's Email Address</label>
            <div className="input-group">
              <div className="input-icon"><Icon name="mail" size={15} /></div>
              <input 
                className="form-input" 
                type="email"
                placeholder="barber@example.com" 
                value={barberEmail} 
                onChange={e => setBarberEmail(e.target.value)} 
                autoFocus 
                onKeyDown={e => e.key === 'Enter' && inviteBarber()} 
              />
            </div>
            <div className="form-hint">Enter the email they used to sign up on BarberBook.</div>
          </div>
          <div className="flex gap-3 mt-4" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost flex-1" onClick={() => setShowInvite(false)}>Cancel</button>
            <button className="btn btn-gold flex-1" onClick={inviteBarber} disabled={inviting || !barberEmail.trim()}>
              {inviting ? <Spinner /> : <Icon name="mail" size={14} />} Send Invite
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── SHOP SETUP ────────────────────────────────────────────────────────────────
export function OwnerShop() {
  const { profile, signOut } = useAuth()
  const { toast } = useToast()
  const { shop, loading, refresh } = useOwnerShop(profile?.id)
  const [form, setForm] = useState({ 
    name: '', 
    address: '', 
    phone: '',
    opening_time: '09:00',
    closing_time: '19:00'
  })
  const [saving, setSaving] = useState(false)
  const [services, setServices] = useState([
    { label: 'Haircut', price: 150, on: true },
    { label: 'Beard Trim', price: 60, on: true },
    { label: 'Full Style', price: 180, on: true },
    { label: 'Head Massage', price: 80, on: false },
    { label: 'Hair Colour', price: 350, on: false },
  ])

  useEffect(() => {
    if (shop) setForm({ 
      name: shop.name || '', 
      address: shop.address || '', 
      phone: shop.phone || '',
      opening_time: shop.opening_time?.substring(0, 5) || '09:00',
      closing_time: shop.closing_time?.substring(0, 5) || '19:00'
    })
  }, [shop])

  const saveShop = async () => {
    if (!form.name.trim()) { toast('Shop name is required', 'error'); return }
    setSaving(true)
    const shopData = { 
      name: form.name, 
      address: form.address, 
      phone: form.phone,
      opening_time: form.opening_time + ':00',
      closing_time: form.closing_time + ':00'
    }
    if (shop) {
      const { error } = await shopsApi.update(shop.id, shopData)
      if (error) toast('Failed to save', 'error')
      else { toast('Shop updated!', 'success'); refresh() }
    } else {
      const { error } = await shopsApi.create({ 
        owner_id: profile.id, 
        ...shopData,
        is_active: true 
      })
      if (error) toast('Failed to create shop', 'error')
      else { toast('Shop created!', 'success'); refresh() }
    }
    setSaving(false)
  }

  if (loading) return <div className="page-inner"><Spinner page /></div>

  return (
    <div className="page-inner">
      {!shop && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid rgba(224,155,51,0.25)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', fontSize: 13, color: 'var(--amber)', marginBottom: 20, lineHeight: 1.5 }}>
          Set up your shop to start accepting bookings. Customers will find you by searching on BarberBook.
        </div>
      )}

      <SectionHead title="Shop Information" />
      <div className="card card-pad mb-6" style={{ marginBottom: 20 }}>
        {[
          { k: 'name',    l: 'Shop Name',    p: "Raja's Barber Shop",   i: 'store', type: 'text' },
          { k: 'address', l: 'Address',       p: 'Anna Nagar, Chennai',  i: 'map', type: 'text' },
          { k: 'phone',   l: 'Contact Phone', p: '+91 98765 43210',      i: 'phone', type: 'text' },
        ].map(f => (
          <div key={f.k} className="form-field">
            <label className="form-label">{f.l}</label>
            <div className="input-group">
              <div className="input-icon"><Icon name={f.i} size={15} /></div>
              <input className="form-input" type={f.type} placeholder={f.p} value={form[f.k]} onChange={e => setForm(ff => ({ ...ff, [f.k]: e.target.value }))} />
            </div>
          </div>
        ))}
        
        <SectionHead title="Operating Hours" />
        <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
          <div className="form-field">
            <label className="form-label">Opening Time</label>
            <div className="input-group">
              <div className="input-icon"><Icon name="clock" size={15} /></div>
              <input 
                className="form-input" 
                type="time" 
                value={form.opening_time} 
                onChange={e => setForm(ff => ({ ...ff, opening_time: e.target.value }))} 
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Closing Time</label>
            <div className="input-group">
              <div className="input-icon"><Icon name="clock" size={15} /></div>
              <input 
                className="form-input" 
                type="time" 
                value={form.closing_time} 
                onChange={e => setForm(ff => ({ ...ff, closing_time: e.target.value }))} 
              />
            </div>
          </div>
        </div>
        
        <button className="btn btn-gold" onClick={saveShop} disabled={saving}>
          {saving ? <Spinner /> : <Icon name="check" size={14} />}
          {saving ? 'Saving…' : shop ? 'Save Changes' : 'Create Shop'}
        </button>
      </div>

      {shop && (
        <>
          <SectionHead title="Services Offered" />
          <div className="card card-pad mb-6" style={{ marginBottom: 20 }}>
            {services.map((sv, i) => (
              <div key={sv.label} className="toggle-row">
                <div>
                  <div className="toggle-row-label">{sv.label}</div>
                  <div className="toggle-row-sub">₹{sv.price}</div>
                </div>
                <Toggle on={sv.on} onToggle={() => setServices(s => s.map((x, j) => j === i ? { ...x, on: !x.on } : x))} />
              </div>
            ))}
          </div>

          <SectionHead title="Plan & Billing" />
          <div className="card card-gold-border card-pad" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 700 }}>Current Plan</div>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 40, color: 'var(--gold)', marginBottom: 4 }}>FREE</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
              30 bookings / month<br/>6 remaining this month
            </div>
            <button className="btn btn-gold btn-full btn-lg" onClick={() => window.open('mailto:hello@barberbook.in?subject=Upgrade%20Plan', '_blank')}>
              Upgrade to Standard — ₹299/month
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>Unlimited bookings · Analytics · Priority listing</div>
          </div>
        </>
      )}

      {/* Sign out */}
      <div className="mt-6" style={{ marginTop: 24 }}>
        <button className="btn btn-danger btn-full" onClick={signOut}>
          <Icon name="logout" size={14} /> Sign Out
        </button>
      </div>
    </div>
  )
}

// ── OWNER PROFILE ─────────────────────────────────────────────────────────────
export function OwnerProfile() {
  const { profile, signOut } = useAuth()
  const { toast } = useToast()

  return (
    <div className="page-inner">
      <div className="card card-pad" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="avatar avatar-xl av-green" style={{ margin: '0 auto 14px', border: '3px solid rgba(61,189,125,0.25)' }}>
          {profile?.initials || '??'}
        </div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{profile?.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{profile?.email}</div>
        {profile?.phone && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>{profile?.phone}</div>}
        <span className="badge badge-green">Shop Owner</span>
      </div>

      <div className="card">
        {[
          { icon: 'store',  label: 'My Shop',       sub: 'Manage shop settings',   href: '/app/shop' },
          { icon: 'users',  label: 'Staff',          sub: 'Add and manage barbers', href: '/app/staff' },
          { icon: 'chart',  label: 'Analytics',      sub: 'Revenue and insights',   href: '/app' },
          { icon: 'phone',  label: 'Phone',           sub: profile?.phone || 'Not set', href: null },
        ].map((item, i) => (
          <div key={i} className="menu-item"
            onClick={() => item.href ? (window.location.href = item.href) : null}
            style={item.href ? {} : { cursor: 'default' }}
          >
            <div className="menu-item-icon"><Icon name={item.icon} size={16} color="var(--green)" /></div>
            <div className="menu-item-text">
              <div className="menu-item-label">{item.label}</div>
              <div className="menu-item-sub">{item.sub}</div>
            </div>
            {item.href && <Icon name="chevRight" size={14} color="var(--text-tertiary)" />}
          </div>
        ))}
        <div className="menu-item" onClick={signOut}>
          <div className="menu-item-icon danger"><Icon name="logout" size={16} color="var(--red)" /></div>
          <div className="menu-item-text"><div className="menu-item-label danger">Sign Out</div></div>
        </div>
      </div>
    </div>
  )
}
