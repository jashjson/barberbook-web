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

// ── BOOKINGS ─────────────────────────────────────────────────────
export const bookings = {
  getBarberQueue: (barberId, date) =>
    supabase.from('bookings')
      .select('*, profiles(name, phone, avatar_url)')
      .eq('barber_id', barberId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`)
      .neq('status', 'cancelled')
      .order('token_no', { ascending: true }),

  getShopQueue: (shopId, date) =>
    supabase.from('bookings')
      .select('*, profiles(name, phone, avatar_url), barbers(name)')
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

  cancel: (id, userId) =>
    supabase.from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId),

  getBookedSlots: (barberId, date) =>
    supabase.from('bookings')
      .select('slot_time').eq('barber_id', barberId)
      .gte('slot_time', `${date}T00:00:00`)
      .lte('slot_time', `${date}T23:59:59`)
      .neq('status', 'cancelled'),
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

  unsubscribe: (channel) => supabase.removeChannel(channel),
}
