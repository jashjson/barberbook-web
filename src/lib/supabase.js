import { createClient } from '@supabase/supabase-js'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL  || 'https://your-project.supabase.co'
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 20 } },
})

// ── AUTH ─────────────────────────────────────────────────────────
// ✅ AUTHENTICATION MODEL:
// - Signup: Email + Password → OTP sent for email verification
// - Login: Email + Password (NO OTP) OR Phone + Password (resolves email, then password login)
// - OTP is ONLY used for email verification during signup
// - Passwords are stored securely in Supabase auth.users (NOT in custom tables)
export const auth = {
  // Signup with email + password. Supabase sends OTP to email for verification.
  // User metadata (name, phone, role) is stored in auth.users.raw_user_meta_data
  signUpWithEmail: ({ email, password, name, phone, role }) =>
    supabase.auth.signUp({
      email, password,
      options: { data: { name, phone, role } },
    }),

  // Verify email OTP after signup. Type 'email' is for email verification.
  verifyEmailOtp: ({ email, token }) =>
    supabase.auth.verifyOtp({ email, token, type: 'email' }),

  // Login with email + password (NO OTP required)
  signInWithEmail: ({ email, password }) =>
    supabase.auth.signInWithPassword({ email, password }),

  // Phone login: resolve email from profiles table, then sign in with password
  // This allows users to login with phone number instead of email
  signInWithPhone: async ({ phone, password }) => {
    const { data: prof, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('phone', phone.replace(/\s/g, ''))
      .maybeSingle()
    if (error || !prof?.email)
      return { error: { message: 'No account found with this phone number.' } }
    return supabase.auth.signInWithPassword({ email: prof.email, password })
  },

  // Resend OTP for email verification during signup
  resendOtp: (email) =>
    supabase.auth.resend({ type: 'signup', email, options: {} }),

  signOut: () => supabase.auth.signOut(),
  getSession: () => supabase.auth.getSession(),
  onAuthChange: (cb) => supabase.auth.onAuthStateChange(cb),
}

// ── PROFILES ─────────────────────────────────────────────────────
export const profiles = {
  get: (uid) => supabase.from('profiles').select('*').eq('id', uid).single(),
  upsert: (data) => supabase.from('profiles').upsert(data).select().single(),
  update: (uid, data) => supabase.from('profiles').update(data).eq('id', uid).select().single(),
}

// ── SHOPS ────────────────────────────────────────────────────────
export const shops = {
  getAll: () =>
    supabase.from('shops')
      .select('*, barbers(id,name,is_available,profile_id)')
      .eq('is_active', true).order('name'),

  getByOwner: (ownerId) =>
    supabase.from('shops')
      .select('*, barbers(id,name,is_available)')
      .eq('owner_id', ownerId).order('created_at'),

  getById: (id) =>
    supabase.from('shops')
      .select('*')
      .eq('id', id).single(),

  create: (data) => supabase.from('shops').insert(data).select().single(),
  update: (id, data) => supabase.from('shops').update(data).eq('id', id).select().single(),
}

// ── BARBERS ──────────────────────────────────────────────────────
export const barbers = {
  getByShop: (shopId) =>
    supabase.from('barbers').select('*').eq('shop_id', shopId).eq('is_active', true),

  getByProfile: (profileId) =>
    supabase.from('barbers').select('*, shops(*)').eq('profile_id', profileId).maybeSingle(),

  create: (data) => supabase.from('barbers').insert(data).select().single(),
  update: (id, data) => supabase.from('barbers').update(data).eq('id', id).select().single(),
  setAvailability: (id, is_available) =>
    supabase.from('barbers').update({ is_available }).eq('id', id),
}

// ── SHOP BARBERS (NEW RELATIONSHIP TABLE) ───────────────────────
// This replaces the old "owner creates barber" flow with proper linking
export const shopBarbers = {
  // Get all barber links for a shop (owner view)
  getByShop: (shopId) =>
    supabase.from('shop_barbers')
      .select('*, profiles!shop_barbers_barber_id_fkey(id, name, email, phone, avatar_url)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false }),

  // Get active barbers for a shop (public/booking view)
  getActiveByShop: (shopId) =>
    supabase.from('shop_barbers')
      .select('*, profiles!shop_barbers_barber_id_fkey(id, name, email, phone, avatar_url)')
      .eq('shop_id', shopId)
      .eq('status', 'active')
      .order('created_at'),

  // Get barber's shop links (barber view)
  getByBarber: (barberId) =>
    supabase.from('shop_barbers')
      .select('*, shops(id, name, address, phone, owner_id)')
      .eq('barber_id', barberId)
      .order('created_at', { ascending: false }),

  // Get pending invites for a barber
  getPendingForBarber: (barberId) =>
    supabase.from('shop_barbers')
      .select('*, shops(id, name, address, phone, owner_id, profiles(name))')
      .eq('barber_id', barberId)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false }),

  // Owner invites a barber by email
  inviteBarber: async (shopId, barberEmail, ownerId) => {
    const email = barberEmail.toLowerCase().trim()
    
    // First, find the barber profile by email (without role filter to check if user exists)
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, name, email')
      .eq('email', email)
      .maybeSingle()

    if (profileError) return { error: profileError }
    
    if (!userProfile) {
      return { error: { message: 'No account found with this email. Ask them to sign up first.' } }
    }
    
    if (userProfile.role !== 'barber') {
      return { error: { message: `This user is registered as a ${userProfile.role}, not a barber. Only barber accounts can be invited.` } }
    }

    // Check if already invited or linked
    const { data: existingLink } = await supabase
      .from('shop_barbers')
      .select('id, status')
      .eq('shop_id', shopId)
      .eq('barber_id', userProfile.id)
      .maybeSingle()

    if (existingLink) {
      if (existingLink.status === 'pending') {
        return { error: { message: 'This barber already has a pending invite.' } }
      } else if (existingLink.status === 'active') {
        return { error: { message: 'This barber is already working at your shop.' } }
      }
    }

    // Create the shop_barbers link
    const result = await supabase.from('shop_barbers').insert({
      shop_id: shopId,
      barber_id: userProfile.id,
      status: 'pending',
      invited_by: ownerId,
    }).select('*').single()
    
    // If successful, return with the barber profile data we already have
    if (result.data) {
      result.data.profiles = {
        name: userProfile.name,
        email: userProfile.email
      }
    }
    
    return result
  },

  // Barber accepts an invite
  acceptInvite: (linkId) =>
    supabase.from('shop_barbers')
      .update({ status: 'active', responded_at: new Date().toISOString() })
      .eq('id', linkId)
      .select().single(),

  // Barber rejects an invite
  rejectInvite: (linkId) =>
    supabase.from('shop_barbers')
      .update({ status: 'rejected', responded_at: new Date().toISOString() })
      .eq('id', linkId)
      .select().single(),

  // Owner removes a barber from shop
  removeBarber: (linkId) =>
    supabase.from('shop_barbers')
      .update({ status: 'removed', responded_at: new Date().toISOString() })
      .eq('id', linkId),

  // Toggle barber availability
  setAvailability: (linkId, is_available) =>
    supabase.from('shop_barbers')
      .update({ is_available })
      .eq('id', linkId),

  // Delete invite (before accepted)
  deleteInvite: (linkId) =>
    supabase.from('shop_barbers').delete().eq('id', linkId).eq('status', 'pending'),
}

// ── BOOKINGS ─────────────────────────────────────────────────────
export const bookings = {
  getBarberQueue: (barberId, date) =>
    supabase.from('bookings')
      .select('*, profiles!bookings_user_id_fkey(name, phone, avatar_url)')
      .eq('barber_id', barberId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`)
      .neq('status', 'cancelled')
      .order('token_no', { ascending: true }),

  // NEW: Get barber queue by profile ID (for new schema)
  // Falls back to old schema if barber_profile_id column doesn't exist
  getBarberQueueByProfile: async (barberProfileId, date) => {
    // First, try the new schema with barber_profile_id
    // Specify the foreign key relationship explicitly to avoid ambiguity
    const newSchemaQuery = await supabase.from('bookings')
      .select('*, profiles!bookings_user_id_fkey(name, phone, avatar_url)')
      .eq('barber_profile_id', barberProfileId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`)
      .neq('status', 'cancelled')
      .order('token_no', { ascending: true })
    
    // If new schema returns no results, also try the fallback (old schema)
    // This handles the case where barber_profile_id column exists but has no data
    if (!newSchemaQuery.error && newSchemaQuery.data && newSchemaQuery.data.length === 0) {
      // Find barber record(s) for this profile
      const { data: barberRecords, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('profile_id', barberProfileId)
      
      if (!barberError && barberRecords && barberRecords.length > 0) {
        // Get bookings for all barber records
        const barberIds = barberRecords.map(b => b.id)
        
        const fallbackQuery = await supabase.from('bookings')
          .select('*, profiles!bookings_user_id_fkey(name, phone, avatar_url)')
          .in('barber_id', barberIds)
          .gte('slot_time', `${date}T00:00:00`)
          .lte('slot_time', `${date}T23:59:59`)
          .neq('status', 'cancelled')
          .order('token_no', { ascending: true })
        
        // Return fallback results if they exist
        if (!fallbackQuery.error && fallbackQuery.data && fallbackQuery.data.length > 0) {
          return fallbackQuery
        }
      }
    }
    
    // If there was an error with new schema, try fallback
    if (newSchemaQuery.error) {
      // Find barber record(s) for this profile
      const { data: barberRecords, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('profile_id', barberProfileId)
      
      if (barberError || !barberRecords || barberRecords.length === 0) {
        return { data: [], error: null }
      }
      
      // Get bookings for all barber records
      const barberIds = barberRecords.map(b => b.id)
      
      const fallbackQuery = await supabase.from('bookings')
        .select('*, profiles!bookings_user_id_fkey(name, phone, avatar_url)')
        .in('barber_id', barberIds)
        .gte('slot_time', `${date}T00:00:00`)
        .lte('slot_time', `${date}T23:59:59`)
        .neq('status', 'cancelled')
        .order('token_no', { ascending: true })
      
      return fallbackQuery
    }
    
    return newSchemaQuery
  },

  getShopQueue: (shopId, date) =>
    supabase.from('bookings')
      .select('*, profiles!bookings_user_id_fkey(name, phone, avatar_url), barbers(name)')
      .eq('shop_id', shopId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`)
      .neq('status', 'cancelled')
      .order('token_no', { ascending: true }),

  getUserBookings: (userId) =>
    supabase.from('bookings')
      .select('*, shops(name, address), barbers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

  getUserActiveBooking: (userId) =>
    supabase.from('bookings')
      .select('*, shops(name, address, phone), barbers(name)')
      .eq('user_id', userId)
      .in('status', ['waiting', 'in_chair'])
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle(),

  create: (data) =>
    supabase.from('bookings').insert(data)
      .select('*, shops(name), barbers(name)').single(),

  updateStatus: (id, status) =>
    supabase.from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).select().single(),
  
  update: (id, data) =>
    supabase.from('bookings')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id).select().single(),

  cancel: (id, userId) =>
    supabase.from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single(),
  
  cancelByBarber: (id) =>
    supabase.from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).select().single(),

  getBookedSlots: (barberId, date) =>
    supabase.from('bookings')
      .select('slot_time').eq('barber_id', barberId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`)
      .neq('status', 'cancelled'),

  // NEW: Get booked slots by profile ID
  // Falls back to old schema if barber_profile_id column doesn't exist
  getBookedSlotsByProfile: async (barberProfileId, date) => {
    // First, try the new schema with barber_profile_id
    const newSchemaQuery = await supabase.from('bookings')
      .select('slot_time')
      .eq('barber_profile_id', barberProfileId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`)
      .neq('status', 'cancelled')
    
    // If the column doesn't exist, fall back to old schema
    if (newSchemaQuery.error && newSchemaQuery.error.message?.includes('barber_profile_id')) {
      console.warn('[getBookedSlotsByProfile] barber_profile_id column not found, using fallback')
      
      // Find barber record(s) for this profile
      const { data: barberRecords } = await supabase
        .from('barbers')
        .select('id')
        .eq('profile_id', barberProfileId)
      
      if (!barberRecords || barberRecords.length === 0) {
        return { data: [], error: null }
      }
      
      // Get bookings for all barber records
      const barberIds = barberRecords.map(b => b.id)
      return supabase.from('bookings')
        .select('slot_time')
        .in('barber_id', barberIds)
        .gte('slot_time', `${date}T00:00:00`)
        .lte('slot_time', `${date}T23:59:59`)
        .neq('status', 'cancelled')
    }
    
    return newSchemaQuery
  },
}

// ── ANALYTICS ────────────────────────────────────────────────────
export const analytics = {
  shopRevenue: (shopId, days = 7) => {
    const from = new Date()
    from.setDate(from.getDate() - days)
    return supabase.from('bookings')
      .select('slot_time, price, status, barbers(name)')
      .eq('shop_id', shopId).eq('status', 'done')
      .gte('slot_time', from.toISOString())
  },
  barberStats: (barberId, date) =>
    supabase.from('bookings')
      .select('status, price, service, slot_time')
      .eq('barber_id', barberId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`),
}

// ── REALTIME ─────────────────────────────────────────────────────
export const realtime = {
  subscribeShopQueue: (shopId, callback) =>
    supabase.channel(`shop-queue:${shopId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `shop_id=eq.${shopId}` }, callback)
      .subscribe(),

  subscribeBarberQueue: (barberId, callback) =>
    supabase.channel(`barber-queue:${barberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barber_id=eq.${barberId}` }, callback)
      .subscribe(),

  // NEW: Subscribe to barber queue by profile ID
  subscribeBarberQueueByProfile: (barberProfileId, callback) =>
    supabase.channel(`barber-profile-queue:${barberProfileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barber_profile_id=eq.${barberProfileId}` }, callback)
      .subscribe(),

  unsubscribe: (channel) => supabase.removeChannel(channel),
}

// ── SERVICES ─────────────────────────────────────────────────────
export const services = {
  getByShop: (shopId) =>
    supabase.from('services')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),

  getAll: (shopId) =>
    supabase.from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order', { ascending: true }),

  create: (data) =>
    supabase.from('services').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('services')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),

  delete: (id) =>
    supabase.from('services').delete().eq('id', id),

  reorder: async (shopId, serviceIds) => {
    // Update display_order for multiple services
    const updates = serviceIds.map((id, index) => ({
      id,
      display_order: index
    }))
    
    const promises = updates.map(({ id, display_order }) =>
      supabase.from('services')
        .update({ display_order })
        .eq('id', id)
        .eq('shop_id', shopId)
    )
    
    return Promise.all(promises)
  }
}

// ── REVIEWS ──────────────────────────────────────────────────────
export const reviews = {
  getByShop: (shopId, limit = 50) =>
    supabase.from('reviews')
      .select('*, profiles!reviews_user_id_fkey(name, initials, avatar_url), barbers(name)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit),

  getByBarber: (barberId, limit = 50) =>
    supabase.from('reviews')
      .select('*, profiles!reviews_user_id_fkey(name, initials, avatar_url)')
      .eq('barber_id', barberId)
      .order('created_at', { ascending: false })
      .limit(limit),

  getByBooking: (bookingId) =>
    supabase.from('reviews')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle(),

  canReview: async (bookingId, userId) => {
    // Check if booking is done and user hasn't reviewed yet
    const { data: booking } = await supabase.from('bookings')
      .select('status, user_id')
      .eq('id', bookingId)
      .single()
    
    if (!booking || booking.user_id !== userId || booking.status !== 'done') {
      return { canReview: false, reason: 'Booking not eligible for review' }
    }

    const { data: existingReview } = await supabase.from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle()
    
    if (existingReview) {
      return { canReview: false, reason: 'Already reviewed' }
    }

    return { canReview: true }
  },

  create: (data) =>
    supabase.from('reviews').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('reviews')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),

  delete: (id) =>
    supabase.from('reviews').delete().eq('id', id),
}

// ── NOTIFICATIONS ────────────────────────────────────────────────
export const notifications = {
  getByUser: (userId, limit = 50) =>
    supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),

  getUnreadCount: (userId) =>
    supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),

  markAsRead: (id) =>
    supabase.from('notifications')
      .update({ is_read: true })
      .eq('id', id),

  markAllAsRead: (userId) =>
    supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false),

  delete: (id) =>
    supabase.from('notifications').delete().eq('id', id),

  deleteAll: (userId) =>
    supabase.from('notifications').delete().eq('user_id', userId),

  // Subscribe to real-time notifications
  subscribe: (userId, callback) =>
    supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${userId}` 
      }, callback)
      .subscribe(),
}

// ── FEEDBACK ─────────────────────────────────────────────────────
export const feedback = {
  getByShop: (shopId, limit = 50) =>
    supabase.from('feedback')
      .select('*, profiles!feedback_user_id_fkey(name, initials, avatar_url)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit),

  getByUser: (userId) =>
    supabase.from('feedback')
      .select('*, shops(name, cover_image)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

  create: (data) =>
    supabase.from('feedback').insert(data).select().single(),

  update: (id, data) =>
    supabase.from('feedback')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),

  delete: (id) =>
    supabase.from('feedback').delete().eq('id', id),

  markHelpful: (feedbackId, userId) =>
    supabase.from('feedback_helpful')
      .insert({ feedback_id: feedbackId, user_id: userId }),

  unmarkHelpful: (feedbackId, userId) =>
    supabase.from('feedback_helpful')
      .delete()
      .eq('feedback_id', feedbackId)
      .eq('user_id', userId),

  isHelpful: async (feedbackId, userId) => {
    const { data } = await supabase.from('feedback_helpful')
      .select('id')
      .eq('feedback_id', feedbackId)
      .eq('user_id', userId)
      .maybeSingle()
    return !!data
  },
}

// ── SHOP DISCOVERY ───────────────────────────────────────────────
export const discover = {
  searchShops: async (query = '', filters = {}) => {
    let queryBuilder = supabase.from('shops')
      .select(`
        *,
        shop_images(id, image_url, caption, display_order),
        shop_amenities(amenity),
        shop_tags(tag)
      `)
      .eq('is_active', true)

    // Search query
    if (query) {
      queryBuilder = queryBuilder.or(`name.ilike.%${query}%,description.ilike.%${query}%,address.ilike.%${query}%,area.ilike.%${query}%`)
    }

    // Filters
    if (filters.city) {
      queryBuilder = queryBuilder.ilike('city', filters.city)
    }
    if (filters.area) {
      queryBuilder = queryBuilder.ilike('area', `%${filters.area}%`)
    }
    if (filters.minRating) {
      queryBuilder = queryBuilder.gte('avg_rating', filters.minRating)
    }

    // Sort
    const sortBy = filters.sortBy || 'rating'
    if (sortBy === 'rating') {
      queryBuilder = queryBuilder.order('avg_rating', { ascending: false })
    } else if (sortBy === 'reviews') {
      queryBuilder = queryBuilder.order('feedback_count', { ascending: false })
    } else if (sortBy === 'name') {
      queryBuilder = queryBuilder.order('name', { ascending: true })
    }

    return queryBuilder.limit(filters.limit || 50)
  },

  getShopDetails: (shopId) =>
    supabase.from('shops')
      .select(`
        *,
        shop_images(id, image_url, caption, display_order),
        shop_amenities(amenity),
        shop_tags(tag),
        services(id, name, description, price, duration, display_order)
      `)
      .eq('id', shopId)
      .single(),

  getShopStats: async (shopId) => {
    const { data: feedback } = await supabase.from('feedback')
      .select('rating')
      .eq('shop_id', shopId)

    if (!feedback || feedback.length === 0) {
      return {
        avgRating: 0,
        totalReviews: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      }
    }

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    feedback.forEach(f => distribution[f.rating]++)

    return {
      avgRating: feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length,
      totalReviews: feedback.length,
      ratingDistribution: distribution
    }
  },
}

// ── SHOP IMAGES ──────────────────────────────────────────────────
export const shopImages = {
  getByShop: (shopId) =>
    supabase.from('shop_images')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order', { ascending: true }),

  create: (data) =>
    supabase.from('shop_images').insert(data).select().single(),

  delete: (id) =>
    supabase.from('shop_images').delete().eq('id', id),

  reorder: async (shopId, imageIds) => {
    const updates = imageIds.map((id, index) => ({
      id,
      display_order: index
    }))
    
    const promises = updates.map(({ id, display_order }) =>
      supabase.from('shop_images')
        .update({ display_order })
        .eq('id', id)
        .eq('shop_id', shopId)
    )
    
    return Promise.all(promises)
  },
}

// ── SHOP AMENITIES ───────────────────────────────────────────────
export const shopAmenities = {
  getByShop: (shopId) =>
    supabase.from('shop_amenities')
      .select('*')
      .eq('shop_id', shopId),

  add: (shopId, amenity) =>
    supabase.from('shop_amenities')
      .insert({ shop_id: shopId, amenity })
      .select()
      .single(),

  remove: (shopId, amenity) =>
    supabase.from('shop_amenities')
      .delete()
      .eq('shop_id', shopId)
      .eq('amenity', amenity),
}

// ── SHOP TAGS ────────────────────────────────────────────────────
export const shopTags = {
  getByShop: (shopId) =>
    supabase.from('shop_tags')
      .select('*')
      .eq('shop_id', shopId),

  add: (shopId, tag) =>
    supabase.from('shop_tags')
      .insert({ shop_id: shopId, tag })
      .select()
      .single(),

  remove: (shopId, tag) =>
    supabase.from('shop_tags')
      .delete()
      .eq('shop_id', shopId)
      .eq('tag', tag),

  // Predefined tags
  AVAILABLE_TAGS: [
    'Premium',
    'Budget-Friendly',
    'Kids-Friendly',
    'Beard-Specialist',
    'Styling-Expert',
    'Quick-Service',
    'Walk-In-Welcome',
    'Appointment-Only',
    'Unisex',
    'Men-Only',
  ],
}

// ── STORAGE / IMAGE UPLOAD ───────────────────────────────────────
export const storage = {
  // Upload image to Supabase Storage
  uploadImage: async (file, bucket = 'feedback-images', folder = '') => {
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      // Upload file
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      // Get public URL - use data.path from upload response
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path)

      console.log('Upload successful:', { path: data.path, url: urlData.publicUrl })

      return { data: { path: data.path, url: urlData.publicUrl }, error: null }
    } catch (error) {
      console.error('Upload error:', error)
      return { data: null, error }
    }
  },

  // Upload multiple images
  uploadImages: async (files, bucket = 'feedback-images', folder = '') => {
    const uploads = await Promise.all(
      Array.from(files).map(file => storage.uploadImage(file, bucket, folder))
    )
    
    const errors = uploads.filter(u => u.error)
    if (errors.length > 0) {
      return { data: null, error: errors[0].error }
    }
    
    return { 
      data: uploads.map(u => u.data.url), 
      error: null 
    }
  },

  // Delete image from storage
  deleteImage: async (path, bucket = 'feedback-images') => {
    return supabase.storage
      .from(bucket)
      .remove([path])
  },

  // Get public URL for an image
  getPublicUrl: (path, bucket = 'feedback-images') => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    return data.publicUrl
  },
}

