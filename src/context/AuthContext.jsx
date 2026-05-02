import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, auth, profiles } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

/**
 * AuthProvider - Manages authentication state and operations
 * 
 * ✅ AUTHENTICATION FLOW:
 * 
 * SIGNUP:
 * 1. User enters email + password (and name, phone, role)
 * 2. Call signUp() → Supabase creates user and sends OTP to email
 * 3. User enters OTP from email
 * 4. Call verifyOtp() → Email is verified, session created, profile created
 * 
 * LOGIN:
 * 1. User enters email + password (or phone + password)
 * 2. Call signInEmail() or signInPhone() → User is logged in (NO OTP)
 * 3. Session created, profile loaded
 * 
 * ⚠️ IMPORTANT:
 * - OTP is ONLY used for email verification during signup
 * - Login uses password authentication (NO OTP)
 * - Passwords are stored securely in Supabase auth.users
 * - Profile is created after email verification or on first login
 */

export function AuthProvider({ children }) {
  const [session, setSession]  = useState(null)
  const [profile, setProfile]  = useState(null)
  const [loading, setLoading]  = useState(true)

  const loadProfile = useCallback(async (uid) => {
    const { data } = await profiles.get(uid)
    if (data) setProfile(data)
    return data
  }, [])

  useEffect(() => {
    auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = auth.onAuthChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  // ── SIGN UP: step 1 — register with email + password, send OTP for verification
  const signUp = async ({ email, password, name, phone, role }) => {
    const { data, error } = await auth.signUpWithEmail({ email, password, name, phone, role })
    if (error) return { error }

    // Note: Profile will be created after email verification
    // User metadata (name, phone, role) is stored in auth.users.raw_user_meta_data
    return { data }
  }

  // ── SIGN UP: step 2 — verify email OTP and create profile
  const verifyOtp = async ({ email, token }) => {
    const { data, error } = await auth.verifyEmailOtp({ email, token })
    if (error) return { data, error }

    // After successful verification, create profile if it doesn't exist
    if (data?.user) {
      const userId = data.user.id
      const metadata = data.user.user_metadata || {}
      
      // Check if profile already exists
      const { data: existingProfile } = await profiles.get(userId)
      
      if (!existingProfile) {
        const name = metadata.name || 'User'
        const initials = name.trim().split(' ')
          .filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
        
        await profiles.upsert({
          id: userId,
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: metadata.phone?.replace(/\s/g, '') || '',
          role: metadata.role || 'customer',
          initials,
        })
      }
      
      // Load the profile into context
      await loadProfile(userId)
    }
    
    return { data, error }
  }

  // ── SIGN IN via email + password (NO OTP)
  const signInEmail = async ({ email, password }) => {
    const { data, error } = await auth.signInWithEmail({ email, password })
    if (error) return { data, error }

    // Ensure profile exists (create if missing)
    if (data?.user) {
      const userId = data.user.id
      const { data: existingProfile } = await profiles.get(userId)
      
      if (!existingProfile) {
        const metadata = data.user.user_metadata || {}
        const name = metadata.name || data.user.email?.split('@')[0] || 'User'
        const initials = name.trim().split(' ')
          .filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
        
        await profiles.upsert({
          id: userId,
          name: name.trim(),
          email: data.user.email?.toLowerCase() || email.toLowerCase().trim(),
          phone: metadata.phone?.replace(/\s/g, '') || '',
          role: metadata.role || 'customer',
          initials,
        })
      }
    }
    
    return { data, error }
  }

  // ── SIGN IN via phone (resolves email internally, then password login - NO OTP)
  const signInPhone = async ({ phone, password }) => {
    const { data, error } = await auth.signInWithPhone({ phone, password })
    if (error) return { data, error }

    // Ensure profile exists (create if missing)
    if (data?.user) {
      const userId = data.user.id
      const { data: existingProfile } = await profiles.get(userId)
      
      if (!existingProfile) {
        const metadata = data.user.user_metadata || {}
        const name = metadata.name || data.user.email?.split('@')[0] || 'User'
        const initials = name.trim().split(' ')
          .filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
        
        await profiles.upsert({
          id: userId,
          name: name.trim(),
          email: data.user.email?.toLowerCase() || '',
          phone: phone.replace(/\s/g, ''),
          role: metadata.role || 'customer',
          initials,
        })
      }
    }
    
    return { data, error }
  }

  const signOut = async () => {
    await auth.signOut()
    setSession(null)
    setProfile(null)
  }

  const updateProfile = async (updates) => {
    if (!session?.user) return
    const { data } = await profiles.update(session.user.id, updates)
    if (data) setProfile(data)
    return data
  }

  return (
    <AuthCtx.Provider value={{
      session,
      profile,
      loading,
      isAuthenticated: !!session && !!profile,
      role: profile?.role || null,
      signUp,
      verifyOtp,
      signInEmail,
      signInPhone,
      signOut,
      updateProfile,
      refreshProfile: () => session?.user && loadProfile(session.user.id),
    }}>
      {children}
    </AuthCtx.Provider>
  )
}
