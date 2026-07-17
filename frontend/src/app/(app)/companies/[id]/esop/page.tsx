'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, EsopPlanResponse } from '@/lib/api';
import { formatNumber } from '@/lib/format';

export default function EsopPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const [plans, setPlans] = useState<EsopPlanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.esop.listPlans(companyId).then(setPlans).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [companyId]);

  const s = styles;
  return (
    <div style={s.page}>
      <div style={s.back}><a href={`/companies/${companyId}`} style={s.backLink}>← Back</a></div>
      <div style={s.header}>
        <div><h1 data-ghost="app_esop_headline" style={s.heading}>ESOP Plans</h1><p style={s.sub}>Employee equity grant pools</p></div>
        <a data-ghost="app_esop_new" href={`/companies/${companyId}/esop/new`} className="btn-primary" style={s.cta}>+ New plan</a>
      </div>
      {loading && <p style={s.muted}>Loading…</p>}
      {error && <p style={s.error}>{error}</p>}
      {!loading && plans.length === 0 && <p style={s.muted}>No ESOP plans yet. Create one to start issuing grants.</p>}
      <div data-ghost="app_esop_list" style={s.list}>
        {plans.map(p => (
          <a key={p.id} href={`/companies/${companyId}/esop/${p.id}`} style={s.card}>
            <div style={s.cardTop}>
              <span style={s.name}>{p.name}</span>
              <span style={{ ...s.badge, color: p.status === 'active' ? 'var(--pos)' : 'var(--text-tertiary)' }}>{p.status}</span>
            </div>
            <div style={s.stats}>
              <span style={s.stat}><span style={s.statLabel}>Pool</span><span style={s.mono}>{formatNumber(p.total_pool)}</span></span>
              <span style={s.stat}><span style={s.statLabel}>Allocated</span><span style={s.mono}>{formatNumber(p.allocated)}</span></span>
              <span style={s.stat}><span style={s.statLabel}>Available</span><span style={s.mono}>{formatNumber(Number(p.total_pool) - Number(p.allocated))}</span></span>
              <span style={s.stat}><span style={s.statLabel}>Share class</span><span style={s.mono}>{p.share_class}</span></span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: '720px' }, back: { marginBottom: '24px' },
  backLink: { color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' },
  heading: { fontSize: '28px', fontWeight: 400, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', marginBottom: '4px' },
  sub: { fontSize: '13px', color: 'var(--text-tertiary)' },
  cta: { textDecoration: 'none', padding: '9px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 500 },
  muted: { color: 'var(--text-tertiary)', fontSize: '13px' }, error: { color: 'var(--neg)', fontSize: '13px' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: { display: 'block', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '20px', textDecoration: 'none' },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' },
  name: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' },
  badge: { fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  stats: { display: 'flex', gap: '24px' },
  stat: { display: 'flex', flexDirection: 'column', gap: '3px' },
  statLabel: { fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  mono: { fontSize: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' },
};
