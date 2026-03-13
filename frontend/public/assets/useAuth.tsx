// useAuth.tsx — Vibe Clip Auth Hook + Login Page
// ------------------------------------------------
// Drop this into your React/TypeScript frontend.
// Handles Internet Identity + canister login flow.
//
// Install:
//   npm install @dfinity/auth-client @dfinity/agent @dfinity/principal
//
// Usage:
//   import { AuthProvider, useAuth } from './useAuth'
//   Wrap your app in <AuthProvider>, then use useAuth() anywhere.

import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef
} from 'react'
import { AuthClient } from '@dfinity/auth-client'
import { Actor, HttpAgent, Identity } from '@dfinity/agent'
import { Principal } from '@dfinity/principal'

// ─── CONFIG ──────────────────────────────────────────────────────────────────

// Replace with your deployed auth canister ID (from dfx deploy output)
const AUTH_CANISTER_ID = import.meta.env.VITE_AUTH_CANISTER_ID ?? 'your-auth-canister-id'

// Internet Identity URL — use local replica for dev, mainnet for prod
const II_URL = import.meta.env.DEV
  ? 'http://localhost:4943/?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai'
  : 'https://identity.ic0.app'

const IS_LOCAL = import.meta.env.DEV

// ─── CANISTER IDL (minimal — matches auth.mo public API) ─────────────────────

const authIdl = ({ IDL }: any) => {
  const PublicUser = IDL.Record({
    id:          IDL.Nat,
    username:    IDL.Text,
    displayName: IDL.Text,
    createdAt:   IDL.Int,
  })
  const LoginOk  = IDL.Record({ sessionId: IDL.Text, user: PublicUser })
  const LoginResult = IDL.Variant({ ok: LoginOk, err: IDL.Text })
  const RegisterResult = IDL.Variant({ ok: LoginOk, err: IDL.Text })

  return IDL.Service({
    login:           IDL.Func([], [LoginResult], []),
    register:        IDL.Func([IDL.Text, IDL.Text], [RegisterResult], []),
    logout:          IDL.Func([IDL.Text], [IDL.Bool], []),
    whoami:          IDL.Func([], [IDL.Opt(PublicUser)], []),
    validateSession: IDL.Func([IDL.Text], [IDL.Opt(PublicUser)], ['query']),
  })
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface VibeUser {
  id:          bigint
  username:    string
  displayName: string
  createdAt:   bigint
}

interface AuthState {
  user:          VibeUser | null
  sessionId:     string | null
  isLoading:     boolean
  isAuthenticated: boolean
  error:         string | null
}

interface AuthContextType extends AuthState {
  loginWithII:  () => Promise<void>
  logout:       () => Promise<void>
  register:     (username: string, displayName?: string) => Promise<void>
  clearError:   () => void
  needsRegister: boolean   // true = II auth done, but no Vibe account yet
}

// ─── CONTEXT ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

// ─── PROVIDER ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, sessionId: null, isLoading: true,
    isAuthenticated: false, error: null,
  })
  const [needsRegister, setNeedsRegister] = useState(false)
  const authClientRef = useRef<AuthClient | null>(null)

  // Build actor with current identity
  const getActor = useCallback(async (identity?: Identity) => {
    const agent = new HttpAgent({
      identity,
      host: IS_LOCAL ? 'http://localhost:4943' : 'https://ic0.app',
    })
    if (IS_LOCAL) await agent.fetchRootKey()
    return Actor.createActor(authIdl, { agent, canisterId: AUTH_CANISTER_ID })
  }, [])

  // Restore session on mount
  useEffect(() => {
    ;(async () => {
      const savedSession = localStorage.getItem('vc_session')
      const client = await AuthClient.create()
      authClientRef.current = client

      if (savedSession && await client.isAuthenticated()) {
        const identity = client.getIdentity()
        try {
          const actor = await getActor(identity) as any
          const result = await actor.validateSession(savedSession)
          if (result.length > 0 && result[0]) {
            setState({ user: result[0], sessionId: savedSession, isLoading: false, isAuthenticated: true, error: null })
            return
          }
        } catch {}
        localStorage.removeItem('vc_session')
      }

      setState(s => ({ ...s, isLoading: false }))
    })()
  }, [getActor])

  // Step 1: Authenticate with Internet Identity
  const loginWithII = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }))
    try {
      const client = authClientRef.current ?? await AuthClient.create()
      authClientRef.current = client

      await new Promise<void>((resolve, reject) => {
        client.login({
          identityProvider: II_URL,
          maxTimeToLive: BigInt(30 * 24 * 60 * 60 * 1_000_000_000), // 30 days
          onSuccess: resolve,
          onError:   reject,
        })
      })

      // Step 2: Call auth canister login()
      const identity = client.getIdentity()
      const actor    = await getActor(identity) as any
      const result   = await actor.login()

      if ('ok' in result) {
        const { sessionId, user } = result.ok
        localStorage.setItem('vc_session', sessionId)
        setState({ user, sessionId, isLoading: false, isAuthenticated: true, error: null })
        setNeedsRegister(false)
      } else if (result.err?.includes('register')) {
        // Has II identity but no Vibe Clip account yet
        setNeedsRegister(true)
        setState(s => ({ ...s, isLoading: false, error: null }))
      } else {
        setState(s => ({ ...s, isLoading: false, error: result.err ?? 'Login failed.' }))
      }
    } catch (e: any) {
      setState(s => ({ ...s, isLoading: false, error: e?.message ?? 'Login cancelled.' }))
    }
  }, [getActor])

  // Register new Vibe Clip account (after II auth)
  const register = useCallback(async (username: string, displayName = '') => {
    setState(s => ({ ...s, isLoading: true, error: null }))
    try {
      const client = authClientRef.current!
      const identity = client.getIdentity()
      const actor    = await getActor(identity) as any
      const result   = await actor.register(username, displayName)

      if ('ok' in result) {
        const { sessionId, user } = result.ok
        localStorage.setItem('vc_session', sessionId)
        setState({ user, sessionId, isLoading: false, isAuthenticated: true, error: null })
        setNeedsRegister(false)
      } else {
        setState(s => ({ ...s, isLoading: false, error: result.err ?? 'Registration failed.' }))
      }
    } catch (e: any) {
      setState(s => ({ ...s, isLoading: false, error: e?.message ?? 'Registration error.' }))
    }
  }, [getActor])

  // Logout
  const logout = useCallback(async () => {
    try {
      if (state.sessionId) {
        const client = authClientRef.current!
        const actor  = await getActor(client.getIdentity()) as any
        await actor.logout(state.sessionId)
      }
      await authClientRef.current?.logout()
    } catch {}
    localStorage.removeItem('vc_session')
    setState({ user: null, sessionId: null, isLoading: false, isAuthenticated: false, error: null })
    setNeedsRegister(false)
  }, [state.sessionId, getActor])

  const clearError = useCallback(() => setState(s => ({ ...s, error: null })), [])

  return (
    <AuthContext.Provider value={{ ...state, loginWithII, logout, register, clearError, needsRegister }}>
      {children}
    </AuthContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function LoginPage() {
  const { loginWithII, register, isLoading, error, needsRegister, clearError } = useAuth()
  const [username, setUsername]       = useState('')
  const [displayName, setDisplayName] = useState('')
  const [step, setStep]               = useState<'login' | 'register'>('login')
  const [usernameErr, setUsernameErr] = useState('')

  useEffect(() => {
    if (needsRegister) setStep('register')
  }, [needsRegister])

  const validateUsername = (v: string) => {
    if (v.length < 3)  return 'At least 3 characters required'
    if (v.length > 30) return 'Max 30 characters'
    if (!/^[a-zA-Z0-9_-]+$/.test(v)) return 'Only letters, numbers, _ and - allowed'
    return ''
  }

  const handleRegister = async () => {
    const err = validateUsername(username)
    if (err) { setUsernameErr(err); return }
    await register(username, displayName)
  }

  return (
    <div style={styles.page}>
      {/* Animated background */}
      <div style={styles.bgGrad} />
      <div style={styles.bgNoise} />

      {/* Floating blobs */}
      <div style={{ ...styles.blob, top: '10%', left: '15%', animationDelay: '0s' }} />
      <div style={{ ...styles.blob, top: '60%', right: '10%', animationDelay: '2s', width: 300, height: 300 }} />
      <div style={{ ...styles.blob, bottom: '15%', left: '40%', animationDelay: '4s', width: 200, height: 200, background: 'rgba(236,72,153,0.12)' }} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>▶</div>
          <span style={styles.logoText}>Vibe<span style={styles.logoAccent}>Clip</span></span>
        </div>

        {step === 'login' ? (
          <>
            <h1 style={styles.heading}>Welcome back</h1>
            <p style={styles.sub}>Sign in with Internet Identity — no password needed</p>

            {error && (
              <div style={styles.errorBox}>
                <span>{error}</span>
                <button onClick={clearError} style={styles.errorClose}>✕</button>
              </div>
            )}

            <button
              onClick={loginWithII}
              disabled={isLoading}
              style={{ ...styles.btn, ...(isLoading ? styles.btnDisabled : {}) }}
            >
              {isLoading ? (
                <span style={styles.spinner} />
              ) : (
                <>
                  <IIIcon />
                  Continue with Internet Identity
                </>
              )}
            </button>

            <p style={styles.hint}>
              New to Vibe Clip?{' '}
              <button onClick={() => { clearError(); setStep('register') }} style={styles.link}>
                Create account
              </button>
            </p>

            <div style={styles.divider}><span>Secured by ICP blockchain</span></div>
            <p style={styles.fine}>
              Internet Identity keeps you anonymous — no email or password stored.
            </p>
          </>
        ) : (
          <>
            <h1 style={styles.heading}>
              {needsRegister ? 'One last step' : 'Create account'}
            </h1>
            <p style={styles.sub}>
              {needsRegister
                ? 'Your Internet Identity is verified. Pick a username for Vibe Clip.'
                : 'Set up your Vibe Clip profile.'}
            </p>

            {error && (
              <div style={styles.errorBox}>
                <span>{error}</span>
                <button onClick={clearError} style={styles.errorClose}>✕</button>
              </div>
            )}

            {!needsRegister && (
              <p style={styles.hint} className="mb-4">
                First,{' '}
                <button onClick={loginWithII} style={styles.link} disabled={isLoading}>
                  verify with Internet Identity
                </button>
                {' '}then set your username.
              </p>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Username</label>
              <input
                style={{ ...styles.input, ...(usernameErr ? styles.inputErr : {}) }}
                value={username}
                onChange={e => { setUsername(e.target.value); setUsernameErr('') }}
                placeholder="coolcreator42"
                maxLength={30}
                autoFocus
              />
              {usernameErr && <span style={styles.fieldErr}>{usernameErr}</span>}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Display name <span style={styles.optional}>(optional)</span></label>
              <input
                style={styles.input}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Cool Creator"
                maxLength={50}
              />
            </div>

            <button
              onClick={needsRegister ? handleRegister : loginWithII}
              disabled={isLoading || (!needsRegister && false)}
              style={{ ...styles.btn, ...(isLoading ? styles.btnDisabled : {}) }}
            >
              {isLoading
                ? <span style={styles.spinner} />
                : needsRegister ? 'Create my account' : 'Continue with Internet Identity'
              }
            </button>

            {!needsRegister && (
              <p style={styles.hint}>
                Already have an account?{' '}
                <button onClick={() => { clearError(); setStep('login') }} style={styles.link}>
                  Sign in
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── INTERNET IDENTITY ICON ───────────────────────────────────────────────────

function IIIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 100 100" style={{ marginRight: 10 }}>
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"/>
      <circle cx="50" cy="50" r="18" fill="currentColor"/>
    </svg>
  )
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#06060a',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  bgGrad: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgNoise: {
    position: 'absolute', inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
    pointerEvents: 'none',
  },
  blob: {
    position: 'absolute',
    width: 400, height: 400,
    borderRadius: '50%',
    background: 'rgba(99,102,241,0.08)',
    filter: 'blur(80px)',
    animation: 'blobFloat 8s ease-in-out infinite alternate',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: '44px 40px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 32,
  },
  logoIcon: {
    width: 38, height: 38,
    background: 'linear-gradient(135deg, #6366f1, #ec4899)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, color: '#fff',
  },
  logoText: {
    fontSize: '1.4rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em',
  },
  logoAccent: { color: '#818cf8' },
  heading: {
    fontSize: '1.65rem', fontWeight: 700, color: '#f1f5f9',
    letterSpacing: '-0.03em', marginBottom: 8,
  },
  sub: {
    fontSize: '0.9rem', color: '#64748b', marginBottom: 28, lineHeight: 1.5,
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 10, padding: '12px 16px',
    color: '#fca5a5', fontSize: '0.875rem',
    marginBottom: 20,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
  },
  errorClose: {
    background: 'none', border: 'none', color: '#f87171',
    cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0,
  },
  btn: {
    width: '100%', padding: '13px 20px',
    background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    border: 'none', borderRadius: 12,
    color: '#fff', fontSize: '0.95rem', fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, transition: 'opacity 0.2s, transform 0.15s',
    boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  spinner: {
    width: 18, height: 18,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.7s linear infinite',
  },
  hint: {
    textAlign: 'center', color: '#64748b', fontSize: '0.875rem', marginBottom: 24,
  },
  link: {
    background: 'none', border: 'none', color: '#818cf8',
    cursor: 'pointer', fontSize: 'inherit', padding: 0, textDecoration: 'underline',
  },
  divider: {
    textAlign: 'center', color: '#334155', fontSize: '0.75rem',
    borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, marginBottom: 12,
  },
  fine: {
    textAlign: 'center', color: '#334155', fontSize: '0.78rem',
  },
  field: { marginBottom: 18 },
  label: { display: 'block', color: '#94a3b8', fontSize: '0.82rem', marginBottom: 6, fontWeight: 500 },
  optional: { color: '#475569', fontWeight: 400 },
  input: {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#f1f5f9', fontSize: '0.95rem',
    outline: 'none', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  },
  inputErr: { borderColor: 'rgba(239,68,68,0.5)' },
  fieldErr: { color: '#f87171', fontSize: '0.8rem', marginTop: 4, display: 'block' },
}
