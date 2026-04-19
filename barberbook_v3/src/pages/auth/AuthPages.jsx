import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { auth } from '../../lib/supabase'
import Icon from '../../components/ui/Icon'
import { Spinner } from '../../components/ui/Primitives'

// ─────────────────────────────────────────────────────────────────
//  SHARED: Hero panel (right side on desktop)
// ─────────────────────────────────────────────────────────────────
function AuthHero({ title, sub }) {
  return (
    <div className="auth-hero">
      <div className="auth-hero-bg" />
      <div className="auth-hero-content">
        <div className="auth-hero-title"
          dangerouslySetInnerHTML={{ __html: title }} />
        <p className="auth-hero-sub">{sub}</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
          {['Live queue updates', 'Token system', 'No waiting'].map(f => (
            <span key={f} style={{
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
            }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  OTP INPUT — 6 boxes
// ─────────────────────────────────────────────────────────────────
function OtpInput({ value, onChange, onComplete, disabled }) {
  const inputs = useRef([])
  const digits = (value + '      ').slice(0, 6).split('')

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = value.slice(0, i) + value.slice(i + 1)
      onChange(next)
      if (i > 0) inputs.current[i - 1]?.focus()
      return
    }
    if (e.key === 'ArrowLeft' && i > 0) { inputs.current[i - 1]?.focus(); return }
    if (e.key === 'ArrowRight' && i < 5) { inputs.current[i + 1]?.focus(); return }
  }

  const handleInput = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1)
    if (!char) return
    const next = (value + '      ').slice(0, 6).split('')
    next[i] = char
    const joined = next.join('').replace(/ /g, '').slice(0, 6)
    onChange(joined)
    if (i < 5) inputs.current[i + 1]?.focus()
    if (joined.length === 6) onComplete?.(joined)
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    if (pasted.length === 6) { inputs.current[5]?.focus(); onComplete?.(pasted) }
    else inputs.current[pasted.length]?.focus()
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {[0,1,2,3,4,5].map(i => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i].trim()}
          disabled={disabled}
          onChange={e => handleInput(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
          style={{
            width: 46, height: 54,
            textAlign: 'center',
            fontSize: 22, fontWeight: 700,
            background: 'var(--surface-3)',
            border: `1px solid ${digits[i].trim() ? 'var(--gold)' : 'var(--outline-2)'}`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 0.15s',
            fontFamily: 'monospace',
            caretColor: 'var(--gold)',
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  LOGIN PAGE — email or phone, password
// ─────────────────────────────────────────────────────────────────
export function LoginPage() {
  const { signInEmail, signInPhone } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [method, setMethod]   = useState('email') // 'email' | 'phone'
  const [identifier, setId]   = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const validate = () => {
    const e = {}
    if (!identifier.trim()) {
      e.identifier = method === 'email' ? 'Email address is required' : 'Phone number is required'
    } else if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      e.identifier = 'Enter a valid email address'
    } else if (method === 'phone' && !/^\+?[0-9]{10,13}$/.test(identifier.replace(/\s/g, ''))) {
      e.identifier = 'Enter a valid phone number'
    }
    if (!password) e.password = 'Password is required'
    else if (password.length < 6) e.password = 'Password must be at least 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const { error } =
      method === 'email'
        ? await signInEmail({ email: identifier.trim().toLowerCase(), password })
        : await signInPhone({ phone: identifier.trim(), password })
    setLoading(false)
    if (error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('invalid') || msg.includes('credentials')) {
        toast('Incorrect email/phone or password.', 'error')
      } else if (msg.includes('not found') || msg.includes('no account')) {
        toast('No account found. Please sign up first.', 'error')
      } else if (msg.includes('confirm') || msg.includes('verify')) {
        toast('Please verify your email before logging in.', 'error')
      } else {
        toast(error.message || 'Sign in failed. Please try again.', 'error')
      }
    } else {
      navigate('/app', { replace: true })
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-side">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">✂</div>
          <div className="auth-logo-text">Barber<span>Book</span></div>
        </div>

        <h1 className="auth-heading">Welcome back</h1>
        <p className="auth-sub">Sign in to your account to continue.</p>

        {/* Method toggle */}
        <div style={{
          display: 'flex', background: 'var(--surface-3)',
          border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)',
          padding: 4, marginBottom: 24, gap: 4,
        }}>
          {[
            { id: 'email', label: 'Email', icon: 'info' },
            { id: 'phone', label: 'Phone', icon: 'phone' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMethod(m.id); setId(''); setErrors({}) }}
              style={{
                flex: 1, padding: '9px 12px', border: 'none', cursor: 'pointer',
                borderRadius: 'calc(var(--radius-sm) - 2px)',
                background: method === m.id ? 'var(--gold)' : 'transparent',
                color: method === m.id ? 'var(--black)' : 'var(--text-secondary)',
                fontWeight: method === m.id ? 700 : 500,
                fontSize: 13.5, transition: 'all 0.18s', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Icon name={m.icon} size={14} />
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label className="form-label">
              {method === 'email' ? 'Email Address' : 'Phone Number'}
            </label>
            <div className="input-group">
              <div className="input-icon">
                <Icon name={method === 'email' ? 'info' : 'phone'} size={16} />
              </div>
              <input
                key={method}
                className="form-input"
                type={method === 'email' ? 'email' : 'tel'}
                inputMode={method === 'email' ? 'email' : 'tel'}
                autoComplete={method === 'email' ? 'email' : 'tel'}
                placeholder={method === 'email' ? 'you@example.com' : '+91 98765 43210'}
                value={identifier}
                onChange={e => { setId(e.target.value); setErrors(er => ({ ...er, identifier: '' })) }}
                autoFocus
              />
            </div>
            {errors.identifier && <div className="form-error">{errors.identifier}</div>}
          </div>

          <div className="form-field">
            <label className="form-label">Password</label>
            <div className="input-group" style={{ position: 'relative' }}>
              <div className="input-icon"><Icon name="lock" size={16} /></div>
              <input
                className="form-input"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(er => ({ ...er, password: '' })) }}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', display: 'flex',
                }}
              >
                <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </div>
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>

          <button
            className="btn btn-gold btn-full btn-lg"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading && <Spinner />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="divider-text" style={{ marginTop: 24 }}>
          New to BarberBook?
        </div>

        <Link
          to="/register"
          className="btn btn-ghost btn-full"
          style={{ textAlign: 'center', textDecoration: 'none' }}
        >
          Create an account
        </Link>
      </div>

      <AuthHero
        title="WELCOME<br/><span>BACK.</span>"
        sub="Continue managing your bookings, queue, and shop in real time."
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  REGISTER PAGE — 3 steps: details → role → email OTP
// ─────────────────────────────────────────────────────────────────
const ROLES = [
  { id: 'customer', icon: 'user',  label: 'Customer',   sub: 'Book appointments & track queue' },
  { id: 'barber',   icon: 'scissors', label: 'Barber',  sub: 'Manage your daily queue' },
  { id: 'owner',    icon: 'store', label: 'Shop Owner',  sub: 'Analytics & staff management' },
]

export function RegisterPage() {
  const { signUp, verifyOtp } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1) // 1 = details, 2 = role, 3 = OTP
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirm: '', role: 'customer',
  })
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [errors, setErrors]     = useState({})
  const [otp, setOtp]           = useState('')
  const [otpError, setOtpError] = useState('')
  const [resendCd, setResendCd] = useState(0) // countdown seconds

  // Countdown timer for resend
  useEffect(() => {
    if (resendCd <= 0) return
    const t = setTimeout(() => setResendCd(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCd])

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    setErrors(er => ({ ...er, [k]: '' }))
  }

  // ── Step 1 validation
  const validateStep1 = () => {
    const e = {}
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = 'Enter your full name (at least 2 characters)'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Enter a valid email address'
    if (!form.phone.replace(/\s/g, '') ||
        !/^\+?[0-9]{10,13}$/.test(form.phone.replace(/\s/g, '')))
      e.phone = 'Enter a valid phone number (10–13 digits)'
    if (!form.password || form.password.length < 8)
      e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirm)
      e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => { if (validateStep1()) setStep(2) }

  // ── Step 2 → register → send OTP
  const handleRegister = async () => {
    setLoading(true)
    const { data, error } = await signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.replace(/\s/g, ''),
      role: form.role,
    })
    setLoading(false)
    if (error) {
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('already registered') || msg.includes('already exists')) {
        toast('An account with this email already exists. Please sign in.', 'error')
      } else {
        toast(error.message || 'Registration failed. Please try again.', 'error')
      }
      setStep(1)
    } else {
      setStep(3)
      setResendCd(60)
      toast('Verification code sent to your email.', 'success')
    }
  }

  // ── Step 3 → verify OTP
  const handleVerify = async (code = otp) => {
    if (code.length !== 6) { setOtpError('Enter the 6-digit code from your email.'); return }
    setOtpError('')
    setLoading(true)
    const { error } = await verifyOtp({
      email: form.email.trim().toLowerCase(),
      token: code,
    })
    setLoading(false)
    if (error) {
      setOtpError('Invalid or expired code. Please try again.')
      setOtp('')
    } else {
      toast('Email verified! Welcome to BarberBook.', 'success')
      navigate('/app', { replace: true })
    }
  }

  const handleResend = async () => {
    if (resendCd > 0) return
    setLoading(true)
    const { error } = await auth.resendOtp(form.email.trim().toLowerCase())
    setLoading(false)
    if (error) toast('Could not resend. Please wait and try again.', 'error')
    else { toast('Code resent to your email.', 'success'); setResendCd(60); setOtp('') }
  }

  const stepLabels = ['Your Details', 'Your Role', 'Verify Email']

  return (
    <div className="auth-root">
      <div className="auth-side">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">✂</div>
          <div className="auth-logo-text">Barber<span>Book</span></div>
        </div>

        {/* Step bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          {stepLabels.map((label, i) => {
            const s = i + 1
            const done = step > s
            const current = step === s
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: done ? 'var(--gold)' : current ? 'transparent' : 'var(--surface-4)',
                    color: done ? 'var(--black)' : current ? 'var(--gold)' : 'var(--text-disabled)',
                    border: current ? '2px solid var(--gold)' : 'none',
                    flexShrink: 0,
                  }}>
                    {done ? <Icon name="check" size={11} /> : s}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: current ? 600 : 400,
                    color: current ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-disabled)',
                    whiteSpace: 'nowrap',
                  }}>{label}</span>
                </div>
                {i < 2 && (
                  <div style={{
                    flex: 1, height: 1, margin: '0 8px',
                    background: step > s ? 'var(--gold)' : 'var(--outline)',
                    minWidth: 16,
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── STEP 1: Personal details ── */}
        {step === 1 && (
          <>
            <h1 className="auth-heading">Create your account</h1>
            <p className="auth-sub">Fill in your details. A verification code will be sent to your email.</p>

            <div className="form-field">
              <label className="form-label">Full Name</label>
              <div className="input-group">
                <div className="input-icon"><Icon name="user" size={16} /></div>
                <input className="form-input" placeholder="e.g. Arjun Sharma"
                  value={form.name} onChange={set('name')} autoFocus autoComplete="name" />
              </div>
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>

            <div className="form-field">
              <label className="form-label">Email Address</label>
              <div className="input-group">
                <div className="input-icon"><Icon name="info" size={16} /></div>
                <input className="form-input" type="email" autoComplete="email"
                  placeholder="you@example.com" value={form.email} onChange={set('email')} />
              </div>
              {errors.email && <div className="form-error">{errors.email}</div>}
              <div className="form-hint">Your verification code will be sent here.</div>
            </div>

            <div className="form-field">
              <label className="form-label">Phone Number</label>
              <div className="input-group">
                <div className="input-icon"><Icon name="phone" size={16} /></div>
                <input className="form-input" type="tel" inputMode="tel" autoComplete="tel"
                  placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} />
              </div>
              {errors.phone && <div className="form-error">{errors.phone}</div>}
              <div className="form-hint">Used for shop-level contact. You can also log in with this.</div>
            </div>

            <div className="form-field">
              <label className="form-label">Password</label>
              <div className="input-group" style={{ position: 'relative' }}>
                <div className="input-icon"><Icon name="lock" size={16} /></div>
                <input className="form-input"
                  type={showPw ? 'text' : 'password'} autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password} onChange={set('password')} style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-tertiary)', display: 'flex',
                }}>
                  <Icon name={showPw ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>

            <div className="form-field">
              <label className="form-label">Confirm Password</label>
              <div className="input-group">
                <div className="input-icon"><Icon name="lock" size={16} /></div>
                <input className="form-input" type="password" autoComplete="new-password"
                  placeholder="Repeat your password" value={form.confirm} onChange={set('confirm')} />
              </div>
              {errors.confirm && <div className="form-error">{errors.confirm}</div>}
            </div>

            <button className="btn btn-gold btn-full btn-lg" onClick={handleNext} style={{ marginTop: 8 }}>
              Continue <Icon name="chevRight" size={15} />
            </button>
          </>
        )}

        {/* ── STEP 2: Role selection ── */}
        {step === 2 && (
          <>
            <h1 className="auth-heading">How will you use BarberBook?</h1>
            <p className="auth-sub">
              Select your role. This determines your dashboard and <strong>cannot be changed later</strong> — create separate accounts for different roles.
            </p>

            <div className="role-picker">
              {ROLES.map(r => (
                <div
                  key={r.id}
                  className={`role-option ${form.role === r.id ? 'selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, role: r.id }))}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setForm(f => ({ ...f, role: r.id }))}
                >
                  <div className="role-option-icon">
                    <Icon name={r.icon} size={22} color={form.role === r.id ? 'var(--gold)' : 'var(--text-tertiary)'} />
                  </div>
                  <div className="role-option-label">{r.label}</div>
                  <div className="role-option-sub">{r.sub}</div>
                </div>
              ))}
            </div>

            {form.role === 'owner' && (
              <div style={{
                background: 'var(--amber-bg)', border: '1px solid rgba(224,155,51,0.25)',
                borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                fontSize: 12.5, color: 'var(--amber)', marginBottom: 16, lineHeight: 1.5,
              }}>
                As a Shop Owner, you'll set up your shop and add barbers after registration. Each barber needs their own separate account.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-ghost" style={{ flex: '0 0 auto' }}
                onClick={() => setStep(1)}>
                <Icon name="chevLeft" size={15} /> Back
              </button>
              <button className="btn btn-gold btn-full btn-lg" onClick={handleRegister} disabled={loading}>
                {loading && <Spinner />}
                {loading ? 'Creating account…' : 'Create Account & Send Code'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Email OTP ── */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64,
              background: 'var(--gold-bg)', border: '1px solid var(--gold-bdr)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 26,
            }}>
              ✉️
            </div>
            <h1 className="auth-heading" style={{ textAlign: 'center' }}>Check your email</h1>
            <p className="auth-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
              We sent a 6-digit verification code to<br/>
              <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>
            </p>

            <OtpInput
              value={otp}
              onChange={v => { setOtp(v); setOtpError('') }}
              onComplete={handleVerify}
              disabled={loading}
            />

            {otpError && (
              <div className="form-error" style={{ textAlign: 'center', marginTop: 10 }}>
                {otpError}
              </div>
            )}

            <button
              className="btn btn-gold btn-full btn-lg"
              onClick={() => handleVerify()}
              disabled={loading || otp.length < 6}
              style={{ marginTop: 20 }}
            >
              {loading && <Spinner />}
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <div style={{ marginTop: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
              Didn't receive it? Check your spam folder, or{' '}
              <button
                onClick={handleResend}
                disabled={resendCd > 0 || loading}
                style={{
                  background: 'none', border: 'none', cursor: resendCd > 0 ? 'not-allowed' : 'pointer',
                  color: resendCd > 0 ? 'var(--text-disabled)' : 'var(--gold)',
                  fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
                  textDecoration: resendCd > 0 ? 'none' : 'underline',
                }}
              >
                {resendCd > 0 ? `resend in ${resendCd}s` : 'resend code'}
              </button>
            </div>

            <button
              style={{
                marginTop: 16, background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-tertiary)', fontSize: 13, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5, margin: '16px auto 0',
              }}
              onClick={() => { setStep(1); setOtp(''); setOtpError('') }}
            >
              <Icon name="chevLeft" size={13} /> Change email address
            </button>
          </div>
        )}

        {step < 3 && (
          <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 20 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--gold)', fontWeight: 600 }}>Sign in</Link>
          </p>
        )}
      </div>

      <AuthHero
        title={step === 3 ? 'ALMOST<br/><span>THERE.</span>' : 'JOIN<br/><span>THE</span><br/>QUEUE.'}
        sub="One platform for customers, barbers, and shop owners. Real-time, built for India."
      />
    </div>
  )
}
