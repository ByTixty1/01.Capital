'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) { setError('Email and password are required'); return; }

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

  const s = styles;
  return (
    <main style={s.page} data-auth-page="true">
      <AuthBrandPanel />
      <div style={s.formPanel}>
        <div className="glass-panel" style={s.card}>
          <h1 style={s.heading}>Welcome back</h1>
          <p style={s.sub}>Sign in to your cap table dashboard</p>
          <form onSubmit={handleSubmit} style={s.form}>
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
