import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../ui/Icon'

const ROLE_COLOR = { customer: 'av-gold', barber: 'av-blue', owner: 'av-green' }
const ROLE_LABEL = { customer: 'Customer', barber: 'Barber', owner: 'Shop Owner' }

const NAV = {
  customer: [
    { path: '/app',            label: 'Home',    icon: 'home' },
    { path: '/app/book',       label: 'Book',    icon: 'calendar' },
    { path: '/app/history',    label: 'History', icon: 'history' },
    { path: '/app/profile',    label: 'Profile', icon: 'user' },
  ],
  barber: [
    { path: '/app',            label: 'Queue',    icon: 'list' },
    { path: '/app/schedule',   label: 'Schedule', icon: 'calendar' },
    { path: '/app/earnings',   label: 'Earnings', icon: 'rupee' },
    { path: '/app/profile',    label: 'Profile',  icon: 'user' },
  ],
  owner: [
    { path: '/app',            label: 'Dashboard',icon: 'dashboard' },
    { path: '/app/bookings',   label: 'Bookings', icon: 'list' },
    { path: '/app/staff',      label: 'Staff',    icon: 'users' },
    { path: '/app/shop',       label: 'My Shop',  icon: 'store' },
    { path: '/app/profile',    label: 'Profile',  icon: 'user' },
  ],
}

function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.toLocaleTimeString()}</span>
}

export function AppLayout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef()

  const role = profile?.role
  const navItems = NAV[role] || []
  const currentPath = location.pathname
  const currentNav = navItems.find(n => n.path === currentPath) || navItems[0]

  // Close menu on outside click
  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const goTo = (path) => { navigate(path); setShowUserMenu(false) }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (!profile) return null

  const avCls = ROLE_COLOR[role] || 'av-gold'
  const initials = profile.initials || profile.name?.slice(0, 2).toUpperCase() || 'BB'

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-mark">✂</div>
          <div>
            <div className="sb-logo-text">Barber<span>Book</span></div>
            <div className="sb-logo-sub">Queue System</div>
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-sec-label">Navigation</div>
          {navItems.map(n => (
            <button
              key={n.path}
              className={`sb-nav-btn ${currentPath === n.path ? 'active' : ''}`}
              onClick={() => goTo(n.path)}
            >
              <Icon name={n.icon} size={16} />
              {n.label}
            </button>
          ))}
        </div>

        {/* User block */}
        <div className="sb-user-block" ref={menuRef} style={{ position: 'relative' }}>
          <button className="sb-user" onClick={() => setShowUserMenu(v => !v)}>
            <div className={`avatar avatar-md ${avCls}`}>{initials}</div>
            <div className="sb-user-info">
              <div className="sb-user-name">{profile.name}</div>
              <div className="sb-user-role" style={{ color: avCls === 'av-gold' ? 'var(--gold)' : avCls === 'av-blue' ? 'var(--blue)' : 'var(--green)' }}>
                {ROLE_LABEL[role]}
              </div>
            </div>
            <Icon name="chevDown" size={13} color="var(--text-tertiary)" />
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8,
              background: 'var(--surface-3)', border: '1px solid var(--outline-2)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)', zIndex: 99,
            }}>
              <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--outline)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{profile.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{profile.email || profile.phone}</div>
              </div>
              <button onClick={() => goTo('/app/profile')} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'var(--transition)' }}>
                <Icon name="user" size={14} /> Profile Settings
              </button>
              <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', background: 'none', border: 'none', color: 'var(--red)', fontSize: 13, cursor: 'pointer', transition: 'var(--transition)', borderTop: '1px solid var(--outline)' }}>
                <Icon name="logout" size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Header ── */}
      <header className="app-header">
        <div>
          <div className="header-title">{currentNav?.label || 'BarberBook'}</div>
          <div className="header-breadcrumb">
            {ROLE_LABEL[role]} · <Clock />
          </div>
        </div>
        <div className="header-right">
          <div className="live-indicator">
            <div className="live-dot" /> LIVE
          </div>
          <div className={`avatar avatar-md ${avCls}`} style={{ cursor: 'pointer' }} onClick={() => goTo('/app/profile')}>
            {initials}
          </div>
        </div>
      </header>

      {/* ── Page Body ── */}
      <div className="page-body">{children}</div>

      {/* ── Mobile Nav ── */}
      <nav className="mobile-nav">
        {navItems.slice(0, 4).map(n => (
          <button
            key={n.path}
            className={`mob-tab ${currentPath === n.path ? 'active' : ''}`}
            onClick={() => goTo(n.path)}
          >
            <Icon name={n.icon} size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
