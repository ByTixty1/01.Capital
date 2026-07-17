'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ProRataRightResponse, ProRataStatus, StakeholderResponse } from '@/lib/api';
import { formatSAR } from '@/lib/format';

const STATUS_COLORS: Record<ProRataStatus, string> = {
  active: 'var(--warn)',
  exercised: 'var(--pos)',
  waived: 'var(--text-tertiary)',
  expired: 'var(--neg)',
};

export default function ProRataPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const [rights, setRights] = useState<ProRataRightResponse[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stakeholderId, setStakeholderId] = useState('');
  const [roundName, setRoundName] = useState('');
  const [maxInvestment, setMaxInvestment] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    Promise.all([api.proRata.list(companyId), api.stakeholders.list(companyId)])
      .then(([r, s]) => {
        setRights(r);
        setStakeholders(s);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load pro-rata rights'))
      .finally(() => setLoading(false));
  }, [companyId]);

  // Names keyed by stakeholder id so the table can label the ID column.
  const stakeholderName = (id: string): string | null =>
    stakeholders.find(s => s.id === id)?.name_en ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!stakeholderId) {
      setError('Select a stakeholder.');
      return;
    }
    const max = Number(maxInvestment);
    if (!Number.isFinite(max) || max <= 0) {
      setError('Enter a valid maximum investment in SAR.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.proRata.create(companyId, {
        stakeholder_id: stakeholderId,
        round_name: roundName.trim(),
        max_investment_sar: max,
        deadline: deadline || undefined,
      });
      setRights(prev => [created, ...prev]);
      setShowForm(false);
      setStakeholderId('');
      setRoundName('');
      setMaxInvestment('');
      setDeadline('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create pro-rata right');
    } finally {
      setSubmitting(false);
    }
  }

  async function exercise(r: ProRataRightResponse) {
    setError(null);
    const input = window.prompt(
      `Exercise amount in SAR (maximum ${formatSAR(r.max_investment_sar)}):`,
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid positive exercise amount.');
      return;
    }
    if (amount > Number(r.max_investment_sar)) {
      setError(`Exercise amount exceeds the maximum of ${formatSAR(r.max_investment_sar)}.`);
      return;
    }
    try {
      const updated = await api.proRata.exercise(companyId, r.id, amount);
      setRights(prev => prev.map(x => (x.id === r.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to exercise pro-rata right');
    }
  }

  async function waive(r: ProRataRightResponse) {
    setError(null);
    if (!window.confirm(`Waive the pro-rata right for "${r.round_name}"? This cannot be undone.`)) {
      return;
    }
    try {
      const updated = await api.proRata.waive(companyId, r.id);
      setRights(prev => prev.map(x => (x.id === r.id ? updated : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to waive pro-rata right');
    }
  }

  const s = styles;
  return (
    <div style={s.page}>
      <div style={s.back}><a href={`/companies/${companyId}`} style={s.backLink}>← Back</a></div>
      <div style={s.headRow}>
        <div>
          <h1 data-ghost="app_prorata_headline" style={s.heading}>Pro-rata rights</h1>
          <p style={s.sub}>
            Pre-emptive subscription rights (Saudi Companies Law Art. 142). Track each granted
            right, then record whether the holder exercises or waives it.
          </p>
        </div>
        <button data-ghost="app_prorata_add" onClick={() => setShowForm(v => !v)} style={s.addBtn}>
          {showForm ? 'Cancel' : 'Add'}
        </button>
      </div>

      {error && <p style={s.error}>{error}</p>}

      {showForm && (
        <form onSubmit={submit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Stakeholder</label>
            <select
              value={stakeholderId}
              onChange={e => setStakeholderId(e.target.value)}
              style={s.input}
              required
            >
              <option value="">Select a stakeholder…</option>
              {stakeholders.map(st => (
                <option key={st.id} value={st.id}>{st.name_en}</option>
              ))}
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Round name</label>
            <input
              value={roundName}
              onChange={e => setRoundName(e.target.value)}
              placeholder="Series A"
              style={s.input}
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Max investment (SAR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxInvestment}
              onChange={e => setMaxInvestment(e.target.value)}
              placeholder="1000000"
              style={{ ...s.input, fontFamily: 'var(--font-mono)' }}
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Deadline (optional)</label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              style={{ ...s.input, fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <button type="submit" disabled={submitting} style={s.submitBtn}>
            {submitting ? 'Saving…' : 'Create right'}
          </button>
        </form>
      )}

      <div data-ghost="app_prorata_list">
      {loading && <p style={s.muted}>Loading…</p>}
      {!loading && rights.length === 0 && (
        <p style={s.muted}>No pro-rata rights yet. Use “Add” to grant one to a stakeholder.</p>
      )}

      {!loading && rights.length > 0 && (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Stakeholder ID</th>
              <th style={s.th}>Round</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Max Investment SAR</th>
              <th style={s.th}>Deadline</th>
              <th style={s.th}>Status</th>
              <th style={{ ...s.th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rights.map(r => {
              const name = stakeholderName(r.stakeholder_id);
              return (
                <tr key={r.id} style={s.tr}>
                  <td style={s.td}>
                    {name && <div style={s.shName}>{name}</div>}
                    <span style={s.mono}>{r.stakeholder_id}</span>
                  </td>
                  <td style={s.td}>{r.round_name}</td>
                  <td style={{ ...s.td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {formatSAR(r.max_investment_sar)}
                  </td>
                  <td style={{ ...s.td, fontFamily: 'var(--font-mono)' }}>{r.deadline ?? '—'}</td>
                  <td style={s.td}>
                    <span style={{ ...s.statusBadge, color: STATUS_COLORS[r.status] }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    {r.status === 'active' ? (
                      <div style={s.actions}>
                        <button onClick={() => exercise(r)} style={{ ...s.actionBtn, color: 'var(--pos)' }}>
                          Exercise
                        </button>
                        <button onClick={() => waive(r)} style={{ ...s.actionBtn, color: 'var(--text-tertiary)' }}>
                          Waive
                        </button>
                      </div>
                    ) : r.status === 'exercised' && r.exercised_amount_sar ? (
                      <span style={s.exercised}>{formatSAR(r.exercised_amount_sar)}</span>
                    ) : (
                      <span style={s.muted}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: '960px' },
  back: { marginBottom: '24px' },
  backLink: { color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' },
  headRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', marginBottom: '28px' },
  heading: { fontSize: '28px', fontWeight: 400, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', marginBottom: '6px' },
  sub: { fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '560px' },
  addBtn: { background: 'var(--brand-purple)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '13px', padding: '8px 18px', cursor: 'pointer', flexShrink: 0 },
  error: { color: 'var(--neg)', fontSize: '13px', marginBottom: '16px' },
  muted: { color: 'var(--text-tertiary)', fontSize: '13px' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '28px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 },
  input: { background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '13px', padding: '8px 10px' },
  submitBtn: { gridColumn: '1 / -1', justifySelf: 'start', background: 'var(--brand-purple)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: '13px', padding: '9px 22px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600, padding: '8px 12px', borderBottom: '1px solid var(--border-default)' },
  tr: { borderBottom: '1px solid var(--border-default)' },
  td: { fontSize: '13px', color: 'var(--text-secondary)', padding: '12px', verticalAlign: 'top' as const },
  shName: { fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' },
  mono: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' },
  statusBadge: { fontSize: '11px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  actions: { display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' },
  actionBtn: { background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: '12px', padding: '5px 12px', cursor: 'pointer' },
  exercised: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--pos)' },
};
