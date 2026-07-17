'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, StakeholderResponse, VestingType } from '@/lib/api';
import { todayISO } from '@/lib/format';

type MilestoneInput = { label: string; fraction: string };

export default function IssueGrantPage() {
  const { id: companyId, planId } = useParams<{ id: string; planId: string }>();
  const router = useRouter();
  const [stakeholders, setStakeholders] = useState<StakeholderResponse[]>([]);
  const [stakeholderId, setStakeholderId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [grantDate, setGrantDate] = useState(todayISO);
  const [vestingType, setVestingType] = useState<VestingType>('cliff_monthly');
  const [cliffMonths, setCliffMonths] = useState('12');
  const [totalMonths, setTotalMonths] = useState('48');
  const [milestones, setMilestones] = useState<MilestoneInput[]>([{ label: '', fraction: '' }]);
  const [exercisePrice, setExercisePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSH, setLoadingSH] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stakeholders.list(companyId).then(s => { setStakeholders(s); if (s[0]) setStakeholderId(s[0].id); }).catch(e => setError(e.message)).finally(() => setLoadingSH(false));
  }, [companyId]);

  function updateMilestone(i: number, patch: Partial<MilestoneInput>) {
    setMilestones(ms => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addMilestone() { setMilestones(ms => [...ms, { label: '', fraction: '' }]); }
  function removeMilestone(i: number) { setMilestones(ms => ms.filter((_, idx) => idx !== i)); }

  const fractionSum = milestones.reduce((sum, m) => sum + (Number(m.fraction) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null);

    if (vestingType === 'performance') {
      const cleaned = milestones.filter(m => m.label.trim() && Number(m.fraction) > 0);
      if (cleaned.length === 0) { setError('Add at least one milestone with a label and fraction.'); return; }
      if (fractionSum > 1.0001) { setError(`Milestone fractions sum to ${fractionSum.toFixed(2)} — must not exceed 1.0`); return; }
    }

    setLoading(true);
    try {
      await api.esop.createGrant(companyId, planId, {
        stakeholder_id: stakeholderId,
        quantity: Number(quantity),
        grant_date: grantDate,
        vesting_type: vestingType,
        ...(vestingType === 'cliff_monthly'
          ? { cliff_months: Number(cliffMonths), total_months: Number(totalMonths) }
          : { milestones: milestones.filter(m => m.label.trim() && Number(m.fraction) > 0).map(m => ({ label: m.label.trim(), fraction: Number(m.fraction) })) }),
        exercise_price: exercisePrice ? Number(exercisePrice) : undefined,
        notes: notes || undefined,
      });
      router.push(`/companies/${companyId}/esop/${planId}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }

  const s = styles;
  return (
    <div style={s.page}>
      <div style={s.back}><a href={`/companies/${companyId}/esop/${planId}`} style={s.backLink}>← Plan</a></div>
      <h1 style={s.heading}>Issue grant</h1>
      <p style={s.sub}>Issue an equity grant from this ESOP plan to a stakeholder.</p>
      {loadingSH ? <p style={s.muted}>Loading…</p> : (
        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Stakeholder *<select value={stakeholderId} onChange={e => setStakeholderId(e.target.value)} required style={s.input}>{stakeholders.map(st => <option key={st.id} value={st.id}>{st.name_en}</option>)}</select></label>
          <label style={s.label}>Number of shares *<input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} required min="1" step="1" style={{ ...s.input, fontFamily: 'var(--font-mono)' }} /></label>
          <label style={s.label}>Grant date *<input type="date" value={grantDate} onChange={e => setGrantDate(e.target.value)} required style={{ ...s.input, fontFamily: 'var(--font-mono)' }} /></label>

          <label style={s.label}>Vesting type
            <select value={vestingType} onChange={e => setVestingType(e.target.value as VestingType)} style={s.input}>
              <option value="cliff_monthly">Time-based (cliff + monthly)</option>
              <option value="performance">Performance / milestone-based</option>
            </select>
          </label>

          {vestingType === 'cliff_monthly' ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ ...s.label, flex: 1 }}>Cliff (months)<input type="number" value={cliffMonths} onChange={e => setCliffMonths(e.target.value)} min="0" style={{ ...s.input, fontFamily: 'var(--font-mono)' }} /></label>
              <label style={{ ...s.label, flex: 1 }}>Total vesting (months)<input type="number" value={totalMonths} onChange={e => setTotalMonths(e.target.value)} min="1" style={{ ...s.input, fontFamily: 'var(--font-mono)' }} /></label>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Milestones (fractions must sum to ≤ 1.0)</span>
              {milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={m.label}
                    onChange={e => updateMilestone(i, { label: e.target.value })}
                    placeholder="e.g. Revenue SAR 10M"
                    style={{ ...s.input, flex: 2 }}
                  />
                  <input
                    type="number"
                    value={m.fraction}
                    onChange={e => updateMilestone(i, { fraction: e.target.value })}
                    placeholder="0.5"
                    min="0" max="1" step="0.01"
                    style={{ ...s.input, flex: 1, fontFamily: 'var(--font-mono)' }}
                  />
                  {milestones.length > 1 && (
                    <button type="button" onClick={() => removeMilestone(i)} style={{ background: 'transparent', border: 'none', color: 'var(--neg)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>×</button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={addMilestone} style={{ background: 'transparent', border: 'none', color: 'var(--brand-purple)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}>+ Add milestone</button>
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: fractionSum > 1.0001 ? 'var(--neg)' : 'var(--text-tertiary)' }}>
                  Σ {fractionSum.toFixed(2)} / 1.00
                </span>
              </div>
            </div>
          )}
          <label style={s.label}>Exercise price per share (SAR)<input type="number" value={exercisePrice} onChange={e => setExercisePrice(e.target.value)} min="0" step="0.0001" style={{ ...s.input, fontFamily: 'var(--font-mono)' }} /></label>
          <label style={s.label}>Notes<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...s.input, resize: 'vertical' as const }} /></label>
          {error && <p style={s.error}>{error}</p>}
          <div style={s.actions}><a href={`/companies/${companyId}/esop/${planId}`} style={s.cancel}>Cancel</a><button type="submit" disabled={loading} className="btn-primary" style={s.submit}>{loading ? 'Issuing…' : 'Issue grant'}</button></div>
        </form>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: '480px' }, back: { marginBottom: '24px' },
  backLink: { color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' },
  heading: { fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' },
  sub: { fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '32px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  label: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' },
  input: { background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: '13px', padding: '10px 12px', outline: 'none', width: '100%' },
  error: { color: 'var(--neg)', fontSize: '13px' }, muted: { color: 'var(--text-tertiary)', fontSize: '13px' },
  actions: { display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center', marginTop: '8px' },
  cancel: { color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' },
  submit: { border: 'none', borderRadius: 'var(--radius-md)', padding: '10px 20px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' },
};
