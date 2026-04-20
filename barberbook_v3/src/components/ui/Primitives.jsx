import Icon from './Icon'

// ── MODAL ─────────────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, maxWidth = 480 }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-sheet" style={{ maxWidth }}>
        <div className="modal-handle" />
        {title && (
          <div className="modal-header">
            <div className="modal-title">{title}</div>
            {onClose && (
              <button className="btn-icon" onClick={onClose}>
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// ── TOGGLE ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onToggle, disabled }) {
  return (
    <div
      className={`toggle ${on ? 'on' : ''} ${disabled ? 'opacity-50' : ''}`}
      onClick={disabled ? undefined : onToggle}
      style={disabled ? { cursor: 'not-allowed' } : {}}
    />
  )
}

// ── SPINNER ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'sm', page }) {
  if (page) return (
    <div className="spinner-page">
      <div className="sb-logo-mark" style={{ marginBottom: 0 }}>
        <Icon name="scissors" size={32} color="var(--gold)" />
      </div>
      <div className="spinner spinner-lg" />
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Loading…</div>
    </div>
  )
  return <div className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} />
}

// ── EMPTY STATE ───────────────────────────────────────────────────────────────
export function Empty({ icon = 'scissors', title, sub, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} size={48} color="var(--text-disabled)" />
      </div>
      <div className="empty-state-title">{title}</div>
      {sub && <div className="empty-state-sub">{sub}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

// ── LIVE BADGE ────────────────────────────────────────────────────────────────
export function LiveBadge() {
  return (
    <div className="live-indicator">
      <div className="live-dot" />
      LIVE
    </div>
  )
}

// ── SECTION HEAD ─────────────────────────────────────────────────────────────
export function SectionHead({ title, action }) {
  return (
    <div className="section-head">
      <div className="section-head-title">{title}</div>
      {action && <div style={{ marginLeft: 'auto', marginRight: 0 }}>{action}</div>}
    </div>
  )
}

// ── STATUS BADGE ──────────────────────────────────────────────────────────────
export function StatusBadge({ status, isYou }) {
  if (isYou) return <span className="badge badge-gold">YOU</span>
  const map = {
    in_chair:  ['badge-red',   'In Chair'],
    waiting:   ['badge-amber', 'Waiting'],
    done:      ['badge-muted', 'Done'],
    cancelled: ['badge-muted', 'Cancelled'],
  }
  const [cls, label] = map[status] || ['badge-muted', status]
  return <span className={`badge ${cls}`}>{label}</span>
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
export function ConfirmDialog({ title, body, onConfirm, onCancel, danger }) {
  return (
    <Modal title={title} onClose={onCancel} maxWidth={360}>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>{body}</p>
      <div className="flex gap-3">
        <button className="btn btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className={`btn flex-1 ${danger ? 'btn-danger' : 'btn-gold'}`} onClick={onConfirm}>Confirm</button>
      </div>
    </Modal>
  )
}
