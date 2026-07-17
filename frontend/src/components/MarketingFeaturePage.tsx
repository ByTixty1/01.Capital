import type { ReactNode } from 'react';
import MarketingLayout from './MarketingLayout';

export interface MarketingFeature {
  title: string;
  desc: string;
  icon: string;
}

/**
 * Shared template for the product marketing pages (cap-table, ESOP,
 * instruments, compliance). Pages own only their copy; layout and styling
 * live here. Footer is either a register CTA or a legal notice panel.
 */
export function MarketingFeaturePage({
  badge,
  headline,
  sub,
  features,
  cta,
  notice,
  ghostPrefix,
}: {
  badge: string;
  headline: ReactNode;
  sub: string;
  features: MarketingFeature[];
  cta?: { heading: string; sub: string };
  notice?: { title: string; body: string };
  /** Qareen data-ghost id prefix for this page — see ghostRegistry.ts.
   * One shared template, four real routes, so ids must be page-scoped
   * (e.g. "esop_headline") rather than reused across routes. */
  ghostPrefix: string;
}) {
  return (
    <MarketingLayout>
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 48px' }}>
        <div style={{ marginBottom: 72 }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--brand-purple)', textTransform: 'uppercase', marginBottom: 20 }}>
            {badge}
          </p>
          <h1 data-ghost={`${ghostPrefix}_headline`} style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.1, maxWidth: 700, marginBottom: 24 }}>
            {headline}
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 560 }}>
            {sub}
          </p>
        </div>

        <div data-ghost={`${ghostPrefix}_features`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 80 }}>
          {features.map(({ title, desc, icon }) => (
            <div key={title} className="glass-panel" style={{ padding: '32px 28px' }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>{icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-0.02em' }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>

        {cta && (
          <div data-ghost={`${ghostPrefix}_cta`} className="glass-panel" style={{ padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
                {cta.heading}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{cta.sub}</p>
            </div>
            <a href="/register" style={{ fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, background: 'var(--brand-purple)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Get started
            </a>
          </div>
        )}

        {notice && (
          <div data-ghost={`${ghostPrefix}_notice`} className="glass-panel" style={{ padding: '48px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.10em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 16 }}>
              {notice.title}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 700 }}>
              {notice.body}
            </p>
          </div>
        )}
      </section>
    </MarketingLayout>
  );
}
