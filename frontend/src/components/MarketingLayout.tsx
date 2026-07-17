'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const MetaballCanvas = dynamic(() => import('./MetaballCanvas'), { ssr: false });
import { Logo } from '@/components/Logo';
import { useQareenStore } from '@/lib/qareen/store';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/cap-table', label: 'Cap Table' },
  { href: '/esop', label: 'ESOP' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/instruments', label: 'Instruments' },
  { href: '/contact', label: 'Contact' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const summoned = useQareenStore((state) => state.summoned);
  const setSummoned = useQareenStore((state) => state.setSummoned);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <MetaballCanvas />

      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: '64px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
        background: 'rgba(14,14,16,0.7)',
      }}>
        <Link href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <Logo size={18} variant="mark" color="currentColor" />
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} style={{
                fontSize: '13px', fontWeight: active ? 500 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                textDecoration: 'none', padding: '6px 14px', borderRadius: '6px',
                transition: 'color 150ms ease, background 150ms ease',
                background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; } }}>
                {label}
              </Link>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Qareen — summons in place on whichever page the user is already on (ADR-0010). */}
          <button
            type="button"
            onClick={() => setSummoned(!summoned)}
            data-on={summoned ? '1' : '0'}
            aria-label={summoned ? 'Dismiss Qareen' : 'Open Qareen, the AI assistant'}
            title="Qareen"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%',
              border: `1px solid ${summoned ? 'rgba(139,92,246,.5)' : 'rgba(255,255,255,.14)'}`,
              background: summoned ? 'rgba(139,92,246,.15)' : 'rgba(255,255,255,.04)',
              color: summoned ? 'var(--brand-purple-hover)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 150ms ease', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
            </svg>
          </button>
          <Link data-ghost="nav_sign_in" href="/login" style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', padding: '7px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 150ms ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--brand-purple)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--brand-purple)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}>
            Sign in
          </Link>
          <Link data-ghost="nav_get_started" href="/register" style={{ fontSize: '13px', fontWeight: 500, color: '#fff', textDecoration: 'none', padding: '7px 16px', borderRadius: '6px', background: 'var(--brand-purple)', transition: 'opacity 150ms ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}>
            Get started
          </Link>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 10, paddingTop: '64px' }}>
        {children}
      </div>

      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'var(--text-primary)' }}><Logo size={18} variant="mark" color="currentColor" /></div>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>© 2026 01 Capital. Saudi Companies Law compliance — for review with legal counsel.</p>
        <div style={{ display: 'flex', gap: '24px' }}>
          {['Privacy', 'Terms', 'Contact'].map(l => (
            <a key={l} href="#" style={{ fontSize: '12px', color: 'var(--text-tertiary)', textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)'; }}>
              {l}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
