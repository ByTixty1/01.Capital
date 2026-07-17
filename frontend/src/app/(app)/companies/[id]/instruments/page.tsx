'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, InstrumentResponse, InstrumentType } from '@/lib/api';
import { formatNumber, formatSAR } from '@/lib/format';

const TYPE_LABELS: Record<InstrumentType, string> = {
  sukuk_convertible: 'Sukuk Convertible',
  phantom: 'Phantom Shares',
  warrant: 'Warrant',
};

export default function InstrumentsPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const [instruments, setInstruments] = useState<InstrumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.instruments.list(companyId).then(setInstruments).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [companyId]);

  const s = styles;
  return (
    <div style={s.page}>
      <div style={s.back}><a href={`/companies/${companyId}`} style={s.backLink}>← Back</a></div>
      <div style={s.header}>
        <div><h1 data-ghost="app_instruments_headline" style={s.heading}>Instruments</h1><p style={s.sub}>Convertible sukuk, phantom shares, and warrants</p></div>
        <a data-ghost="app_instruments_new" href={`/companies/${companyId}/instruments/new`} className="btn-primary" style={s.cta}>+ New instrument</a>
      </div>
      {loading && <p style={s.muted}>Loading…</p>}
      {error && <p style={s.error}>{error}</p>}
      {!loading && instruments.length === 0 && <p style={s.muted}>No instruments recorded.</p>}
      <div data-ghost="app_instruments_list" style={s.list}>
        {instruments.map(inst => (
          <div key={inst.id} style={s.card}>
            <div style={s.cardTop}>
              <div>
                <span style={s.typeBadge}>{TYPE_LABELS[inst.instrument_type] ?? inst.instrument_type}</span>
                <p style={s.name}>{inst.name}</p>
              </div>
              <span style={{ ...s.statusBadge, color: inst.status === 'active' ? 'var(--pos)' : 'var(--text-tertiary)' }}>{inst.status}</span>
            </div>
            <div style={s.stats}>
              <span style={s.stat}><span style={s.statLabel}>Quantity</span><span style={s.mono}>{formatNumber(inst.quantity)}</span></span>
              {inst.face_value && <span style={s.stat}><span style={s.statLabel}>Face value</span><span style={s.mono}>{formatSAR(inst.face_value)}</span></span>}
              <span style={s.stat}><span style={s.statLabel}>Issue date</span><span style={s.mono}>{inst.issue_date}</span></span>
              {inst.maturity_date && <span style={s.stat}><span style={s.statLabel}>Maturity</span><span style={s.mono}>{inst.maturity_date}</span></span>}
            </div>
          </div>
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
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '20px' },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' },
  typeBadge: { display: 'inline-block', background: 'var(--bg-elevated)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '2px 6px', borderRadius: 'var(--radius-sm)', marginBottom: '6px' },
  name: { fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' },
  statusBadge: { fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  stats: { display: 'flex', gap: '24px', flexWrap: 'wrap' as const },
  stat: { display: 'flex', flexDirection: 'column', gap: '3px' },
  statLabel: { fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  mono: { fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' },
};
