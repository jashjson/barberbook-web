import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { notifications as notificationsApi } from '../lib/supabase'

const NotificationContext = createContext()

export function NotificationProvider({ children }) {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(null)

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!profile?.id) return
    
    const { data, error } = await notificationsApi.getByUser(profile.id)
    if (!error && data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
    setLoading(false)
  }

  // Mark notification as read
  const markAsRead = async (id) => {
    const { error } = await notificationsApi.markAsRead(id)
    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    if (!profile?.id) return
    const { error } = await notificationsApi.markAllAsRead(profile.id)
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }
  }

  // Delete notification
  const deleteNotification = async (id) => {
    const { error } = await notificationsApi.delete(id)
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id))
      const wasUnread = notifications.find(n => n.id === id)?.is_read === false
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  // Delete all notifications
  const deleteAll = async () => {
    if (!profile?.id) return
    const { error } = await notificationsApi.deleteAll(profile.id)
    if (!error) {
      setNotifications([])
      setUnreadCount(0)
    }
  }

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!profile?.id) {
      setLoading(false)
      return
    }

    fetchNotifications()

    // Subscribe to new notifications
    channelRef.current = notificationsApi.subscribe(profile.id, (payload) => {
      if (payload.eventType === 'INSERT') {
        setNotifications(prev => [payload.new, ...prev])
        setUnreadCount(prev => prev + 1)
      }
    })

    return () => {
      if (channelRef.current) {
        notificationsApi.unsubscribe(channelRef.current)
      }
    }
  }, [profile?.id])

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAll,
      refresh: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
