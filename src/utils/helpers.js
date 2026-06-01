import { format } from 'date-fns'

// ── DATE & TIME UTILITIES ────────────────────────────────────────────────────
export const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
  return format(new Date(date), formatStr)
}

export const formatTime = (dateTime, formatStr = 'h:mm a') => {
  return format(new Date(dateTime), formatStr)
}

export const formatDateTime = (dateTime, formatStr = 'd MMM, h:mm a') => {
  return format(new Date(dateTime), formatStr)
}

export const formatFullDate = (date) => {
  return format(new Date(date), 'EEEE, d MMMM yyyy')
}

export const formatDayOfWeek = (date) => {
  return format(new Date(date), 'EEE')
}

export const getTodayString = () => {
  return format(new Date(), 'yyyy-MM-dd')
}

export const getMaxBookingDate = (daysAhead = 14) => {
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + daysAhead)
  return format(maxDate, 'yyyy-MM-dd')
}

export const isToday = (dateString) => {
  return dateString === getTodayString()
}

export const isFutureDate = (dateString) => {
  return new Date(dateString) > new Date()
}

// ── VALIDATION UTILITIES ─────────────────────────────────────────────────────
export const validateBookingDate = (selectedDate, selectedTime) => {
  const selectedDateTime = new Date(`${selectedDate}T${selectedTime}:00`)
  const now = new Date()
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 14)
  
  if (selectedDateTime <= now) {
    return { valid: false, error: 'Cannot book a time slot in the past' }
  }
  
  if (selectedDateTime > maxDate) {
    return { valid: false, error: 'Cannot book more than 14 days in advance' }
  }
  
  return { valid: true }
}

// ── FORMATTING UTILITIES ─────────────────────────────────────────────────────
export const formatCurrency = (amount) => {
  return `₹${amount.toLocaleString()}`
}

export const formatTokenNumber = (tokenNo) => {
  return String(tokenNo).padStart(2, '0')
}

export const formatPhoneNumber = (phone) => {
  if (!phone) return 'Not set'
  return phone
}

// ── ARRAY UTILITIES ──────────────────────────────────────────────────────────
export const filterByStatus = (items, status) => {
  return items.filter(item => item.status === status)
}

export const filterActiveQueue = (queue) => {
  return queue.filter(q => q.status !== 'done' && q.status !== 'cancelled')
}

export const calculateTotalRevenue = (bookings) => {
  return bookings.reduce((sum, booking) => sum + (booking.price || 0), 0)
}

// ── STATUS UTILITIES ─────────────────────────────────────────────────────────
export const getStatusLabel = (status) => {
  const statusMap = {
    in_chair: 'In Chair',
    waiting: 'Waiting',
    done: 'Done',
    cancelled: 'Cancelled',
  }
  return statusMap[status] || status
}

export const getStatusBadgeClass = (status) => {
  const classMap = {
    in_chair: 'badge-red',
    waiting: 'badge-amber',
    done: 'badge-muted',
    cancelled: 'badge-muted',
  }
  return classMap[status] || 'badge-muted'
}

// ── INITIALS GENERATOR ───────────────────────────────────────────────────────
export const generateInitials = (name) => {
  if (!name) return '??'
  return name
    .trim()
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── TIME SLOT UTILITIES ──────────────────────────────────────────────────────
export const parseShopHours = (shopHours) => {
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

  return {
    openHour: parseHour(shopHours.opening, 9),
    openMinute: parseMinute(shopHours.opening),
    closeHour: parseHour(shopHours.closing, 19),
    closeMinute: parseMinute(shopHours.closing)
  }
}