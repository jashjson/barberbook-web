import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../context/NotificationContext'
import { formatDateTime } from '../../utils/helpers'
import Icon from './Icon'
import { Spinner, Empty } from './Primitives'

export function NotificationBell() {
  const { unreadCount } = useNotifications()
  const [showCenter, setShowCenter] = useState(false)

  return (
    <>
      <button 
        className="notification-bell-btn" 
        onClick={() => setShowCenter(true)}
        aria-label="Notifications"
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {showCenter && <NotificationCenter onClose={() => setShowCenter(false)} />}
    </>
  )
}

export function NotificationCenter({ onClose }) {
  const navigate = useNavigate()
  const { 
    notifications, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    deleteAll 
  } = useNotifications()

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }

    const data = notification.data || {}
    
    switch (notification.type) {
      case 'booking_confirmed':
      case 'booking_reminder':
      case 'status_update':
        navigate('/app')
        break
      case 'review_request':
      case 'booking_cancelled':
        navigate('/app/history')
        break
      default:
        break
    }

    onClose()
  }

  const getNotificationIcon = (type) => {
    const iconMap = {
      booking_confirmed: { icon: 'checkCircle', color: 'var(--green)' },
      booking_reminder: { icon: 'clock', color: 'var(--amber)' },
      booking_cancelled: { icon: 'xCircle', color: 'var(--red)' },
      queue_update: { icon: 'users', color: 'var(--blue)' },
      review_request: { icon: 'star', color: 'var(--gold)' },
      status_update: { icon: 'alertCircle', color: 'var(--blue)' },
    }
    return iconMap[type] || { icon: 'bell', color: 'var(--text-tertiary)' }
  }

  return (
    <div className="notification-overlay" onClick={onClose}>
      <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="notification-header">
          <div className="notification-header-title">
            <Icon name="bell" size={18} />
            <span>Notifications</span>
            {notifications.length > 0 && (
              <span className="notification-count">{notifications.length}</span>
            )}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* Actions */}
        {notifications.length > 0 && (
          <div className="notification-actions">
            <button className="notification-action-btn" onClick={markAllAsRead}>
              <Icon name="check" size={14} />
              <span>Mark all read</span>
            </button>
            <button 
              className="notification-action-btn" 
              onClick={() => {
                if (confirm('Clear all notifications?')) {
                  deleteAll()
                }
              }}
            >
              <Icon name="trash" size={14} />
              <span>Clear all</span>
            </button>
          </div>
        )}

        {/* List */}
        <div className="notification-list">
          {loading ? (
            <div className="notification-empty">
              <Spinner />
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <div className="notification-empty-icon">
                <Icon name="bell" size={32} color="var(--text-disabled)" />
              </div>
              <div className="notification-empty-title">No notifications</div>
              <div className="notification-empty-text">You're all caught up</div>
            </div>
          ) : (
            notifications.map(notification => {
              const { icon, color } = getNotificationIcon(notification.type)
              
              return (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-item-icon" style={{ 
                    background: `${color}10`,
                    borderColor: `${color}20`
                  }}>
                    <Icon name={icon} size={18} color={color} />
                  </div>

                  <div className="notification-item-content">
                    <div className="notification-item-title">
                      {notification.title}
                      {!notification.is_read && <span className="notification-item-dot" />}
                    </div>
                    <div className="notification-item-message">
                      {notification.message}
                    </div>
                    <div className="notification-item-time">
                      {formatDateTime(notification.created_at)}
                    </div>
                  </div>

                  <button
                    className="notification-item-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(notification.id)
                    }}
                    aria-label="Delete"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
