'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { PageBackground } from '@/components/PageBackground';
import { Logo } from '@/components/Logo';
import { useQareenStore } from '@/lib/qareen/store';

const monoSm: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10.5px',
  letterSpacing: '.2em',
  textTransform: 'uppercase',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const summoned = useQareenStore((state) => state.summoned);
  const setSummoned = useQareenStore((state) => state.setSummoned);

  const companyMatch = pathname.match(/^\/companies\/([^/]+)/);
  const activeCompanyId = companyMatch?.[1];
  const inCompany = !!activeCompanyId && activeCompanyId !== 'new';

  // Server state fetched per company route; the rendered value is derived so
  // leaving a company route needs no synchronous setState (Phase 7 will move
  // this read to an RSC layout entirely).
  useEffect(() => {
    if (!inCompany || !activeCompanyId) return;
    let cancelled = false;
    api.companies.get(activeCompanyId)
      .then(c => {
        if (!cancelled) setCompanyName(c.name_en);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, inCompany]);

  const shownCompanyName = inCompany ? companyName : null;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 6, height: 6, background: 'var(--brand-purple)', borderRadius: '50%' }} />
      </div>
    );
  }

  if (!user) return null;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const gap = 12;
  const navH = 52;
  const subH = 38;
  const subGap = 6;
  const contentTop = inCompany
    ? gap + navH + subGap + subH + gap
    : gap + navH + gap;

  return (
    <div className="app-shell" style={{ position: 'relative' }}>
      <PageBackground />

      {/* Primary navbar */}
      <nav className="glass-panel" style={{
        position: 'fixed', top: gap, left: gap, right: gap, height: navH, zIndex: 100,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        padding: '0 22px',
        gap: '24px',
        borderRadius: '18px',
      }}>
        {/* Left: wordmark */}
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Logo size={20} color="var(--text-primary)" />
          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)', display: 'block' }} />
          <span style={{ ...monoSm, fontSize: '9.5px', letterSpacing: '.18em', color: 'var(--text-tertiary)' }}>Riyadh · 2026</span>
        </Link>

        {/* Center: breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard" style={{
            ...monoSm, textDecoration: 'none',
            color: pathname === '/dashboard' ? 'var(--text-primary)' : 'var(--text-tertiary)',
            transition: 'color 0.2s',
          }}
            onMouseEnter={e => { if (pathname !== '/dashboard') (e.currentTarget as HTMLElement).style.color = 'var(--brand-purple)'; }}
            onMouseLeave={e => { if (pathname !== '/dashboard') (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
          >
            Dashboard
          </Link>
          {shownCompanyName && (
            <>
              <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>·</span>
              <span style={{ ...monoSm, fontSize: '10px', letterSpacing: '.14em', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shownCompanyName}
              </span>
            </>
          )}
        </div>

        {/* Right: user + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setSummoned(!summoned)}
            aria-label={summoned ? 'Dismiss Qareen' : 'Open Qareen, the AI assistant'}
            aria-pressed={summoned}
            style={{
              ...monoSm,
              background: summoned ? 'rgba(139,92,246,0.16)' : 'transparent',
              border: `1px solid ${summoned ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.14)'}`,
              borderRadius: '8px',
              color: summoned ? 'var(--brand-purple-hover)' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '7px 10px',
              transition: 'all 0.2s',
            }}
          >
            Qareen
          </button>
          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', display: 'block' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
            }}>
              {user.email.charAt(0).toUpperCase()}
            </div>
            <span style={{ ...monoSm, fontSize: '10px', letterSpacing: '.1em', color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.full_name || user.email.split('@')[0]}
            </span>
          </div>
          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', display: 'block' }} />
          <Link href="/account" style={{
            ...monoSm, textDecoration: 'none',
            color: isActive('/account') ? 'var(--text-primary)' : 'var(--text-tertiary)',
            transition: 'color 0.2s',
          }}>
            Account
          </Link>
          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', display: 'block' }} />
          <button
            onClick={logout}
            style={{
              ...monoSm, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--text-tertiary)', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-purple)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Company sub-nav */}
      {inCompany && (
        <nav className="glass-panel" style={{
          position: 'fixed',
          top: gap + navH + subGap,
          left: gap, right: gap, height: subH, zIndex: 99,
          display: 'flex', alignItems: 'center',
          padding: '0 22px', gap: '24px',
          borderRadius: '12px',
        }}>
          {[
            { label: 'Overview', href: `/companies/${activeCompanyId}`, exact: true },
            { label: 'Stakeholders', href: `/companies/${activeCompanyId}/stakeholders` },
            { label: 'ESOP', href: `/companies/${activeCompanyId}/esop` },
            { label: 'Instruments', href: `/companies/${activeCompanyId}/instruments` },
            { label: 'Pro-Rata Rights', href: `/companies/${activeCompanyId}/pro-rata` },
            { label: 'Filings', href: `/companies/${activeCompanyId}/filings` },
            { label: 'Members', href: `/companies/${activeCompanyId}/members` },
          ].map(({ label, href, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link key={label} href={href} style={{
                ...monoSm, fontSize: '10px', letterSpacing: '.18em',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                paddingBottom: '1px',
                borderBottom: active ? '1.5px solid var(--brand-purple)' : '1.5px solid transparent',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}>
                {active && (
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--brand-purple)', boxShadow: '0 0 10px rgba(139,92,246,.5)', flexShrink: 0 }} />
                )}
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Main content */}
      <main style={{
        position: 'relative', zIndex: 1,
        paddingTop: contentTop,
        paddingLeft: '24px', paddingRight: '24px', paddingBottom: '48px',
        maxWidth: '1200px', margin: '0 auto',
      }}>
        {children}
      </main>
    </div>
  );
}
