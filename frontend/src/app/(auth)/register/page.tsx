'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { setSession } from '@/lib/auth';
import { AuthBrandPanel } from '@/components/AuthBrandPanel';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError('Password must contain uppercase, lowercase, and numbers');
      return;
    }

    setLoading(true);
    try {
      await api.auth.register(email, password, fullName || undefined);
      const res = await api.auth.devVerifyEmail(email);
      await setSession(res.access_token);
      window.location.href = '/dashboard';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      // Provide helpful error messages
      if (message.includes('already')) {
        setError('This email is already registered. Please sign in instead.');
      } else if (message.includes('invalid')) {
        setError('Invalid email address. Please check and try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page} data-auth-page="true">
      <AuthBrandPanel tagline="Join founders managing Saudi equity the right way" />

      {/* Right Panel — Form */}
      <div style={styles.formPanel}>
        <div className="glass-panel" style={styles.card}>
          <h1 style={styles.heading}>Create your account</h1>
          <p style={styles.sub}>Start managing equity in minutes</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Full name</label>
            <input
              data-ghost="register_full_name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="Mohammed Al-Rashidi"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email address</label>
            <input
              data-ghost="register_email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@company.com"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              data-ghost="register_password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="Min. 8 characters"
              style={styles.input}
            />
          </div>

            {error && (
              <div style={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="7" cy="7" r="6" stroke="#ef4444" strokeWidth="1.5" />
                  <path d="M7 4v3.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="7" cy="10" r="0.75" fill="#ef4444" />
                </svg>
                {error}
              </div>
            )}

            <button data-ghost="register_submit" type="submit" disabled={loading} className="btn-primary" style={styles.button}>
              {loading ? (
                <span style={styles.loadingSpinner}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                    <path d="M8 2a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Creating account…
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p style={styles.terms}>
            By creating an account, you agree this is a <strong>DRAFT</strong> tool — review all equity data with legal counsel.
          </p>

          <p style={styles.footer}>
            Already have an account?{' '}
            <a href="/login" className="link-accent" style={styles.link}>Sign in</a>
          </p>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: 'var(--bg-base)',
  },
  formPanel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 40px',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    padding: '48px',
  },
  heading: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '8px',
    letterSpacing: '-0.02em',
  },
  sub: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    letterSpacing: '0.01em',
  },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    padding: '11px 14px',
    outline: 'none',
    width: '100%',
    transition: 'border-color 150ms ease',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: 'var(--neg)',
  },
  button: {
    marginTop: '4px',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    transition: 'all 150ms ease',
  },
  loadingSpinner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  terms: {
    marginTop: '16px',
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  footer: {
    marginTop: '16px',
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textAlign: 'center',
  },
  link: {
    textDecoration: 'none',
    fontWeight: 500,
  },
};
