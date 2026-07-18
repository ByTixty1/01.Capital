'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';

type Step = 'credentials' | 'mfa';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mfaRef = useRef<HTMLInputElement>(null);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) { setError('Email and password are required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const res = await api.auth.devLogin(email, password);
      await setSession(res.access_token);
      window.location.href = '/dashboard';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('Invalid credentials')) setError('Email or password is incorrect.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = mfaCode.replace(/\s/g, '');
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app'); return; }

    setLoading(true);
    try {
      const res = await api.auth.mfaVerify(code);
      await setSession(res.access_token);
      window.location.href = '/dashboard';
    } catch {
      setError('Invalid code. Try again.');
      setMfaCode('');
      mfaRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  const s = styles;
  return (
    <main style={s.page} data-auth-page="true">
      <AuthBrandPanel />
      <div style={s.formPanel}>
        <div className="glass-panel" style={s.card}>

          {step === 'credentials' && <>
            <h1 style={s.heading}>Welcome back</h1>
            <p style={s.sub}>Sign in to your cap table dashboard</p>
            <form onSubmit={handleCredentials} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Email address</label>
                <input data-ghost="login_email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="you@company.com" style={s.input} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Password</label>
                <input data-ghost="login_password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="••••••••" style={s.input} />
              </div>
              {error && <ErrorBox msg={error} />}
              <button data-ghost="login_submit" type="submit" disabled={loading} className="btn-primary" style={s.button}>
                {loading ? <Spinner label="Signing in…" /> : 'Sign in'}
              </button>
            </form>
            <p style={s.footer}>
              No account yet?{' '}
              <a href="/register" className="link-accent" style={s.link}>Create one free</a>
            </p>
          </>}

          {step === 'mfa' && <>
            <div style={s.mfaIconWrap}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="12" fill="rgba(255,255,255,0.06)" />
                <rect x="12" y="10" width="16" height="20" rx="3" stroke="var(--text-secondary)" strokeWidth="1.5" />
                <rect x="16" y="24" width="8" height="3" rx="1.5" fill="var(--text-secondary)" />
                <circle cx="20" cy="18" r="3" stroke="var(--text-secondary)" strokeWidth="1.5" />
              </svg>
            </div>
            <h1 style={s.heading}>Two-factor authentication</h1>
            <p style={s.sub}>Enter the 6-digit code from your authenticator app</p>
            <form onSubmit={handleMfa} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Authentication code</label>
                <input
                  ref={mfaRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{ ...s.input, fontFamily: 'var(--font-mono)', fontSize: '22px', letterSpacing: '0.35em', textAlign: 'center' }}
                />
              </div>
              {error && <ErrorBox msg={error} />}
              <button type="submit" disabled={loading || mfaCode.length !== 6} style={s.button}>
                {loading ? <Spinner label="Verifying…" /> : 'Verify'}
              </button>
            </form>
            <button onClick={() => { setStep('credentials'); setError(null); setMfaCode(''); }}
              style={s.backBtn}>← Back to login</button>
          </>}

        </div>
      </div>
    </main>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={styles.errorBox}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="7" cy="7" r="6" stroke="#ef4444" strokeWidth="1.5" />
        <path d="M7 4v3.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="7" cy="10" r="0.75" fill="#ef4444" />
      </svg>
      {msg}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
        <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg-base)' },
  formPanel: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 40px' },
  card: { position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px', padding: '48px' },
  mfaIconWrap: { marginBottom: '16px' },
  heading: { fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' },
  sub: { fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.01em' },
  input: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', padding: '11px 14px', outline: 'none', width: '100%', transition: 'border-color 150ms ease' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--neg)' },
  button: { marginTop: '4px', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em', width: '100%' },
  footer: { marginTop: '20px', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center' },
  link: { textDecoration: 'none', fontWeight: 500 },
  backBtn: { marginTop: '16px', background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '13px', cursor: 'pointer', padding: 0, display: 'block', margin: '16px auto 0' },
};
