'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, CapTableResponse, CompanyResponse } from '@/lib/api';
import { formatNumber, formatSAR } from '@/lib/format';
import { DonutChart } from '@/components/DonutChart';
import { thData, tdData } from '@/lib/table-styles';
import { DeleteCompanyModal } from '@/components/DeleteCompanyModal';

const COLORS = [
  'var(--brand-purple)', '#9b6ff0', '#c4a8f8', '#6ee7b7',
  '#fbbf24', '#f87171', '#60a5fa', '#a78bfa',
];

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<CompanyResponse | null>(null);
  const [capTable, setCapTable] = useState<CapTableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [diluted, setDiluted] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [packing, setPacking] = useState(false);

  async function handleExportPdf() {
    setExporting(true);
    setError(null);
    try {
      await api.documents.capTablePdf(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleAuditPack() {
    setPacking(true);
    setError(null);
    try {
      await api.documents.auditPackZip(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit pack export failed');
    } finally {
      setPacking(false);
    }
  }

  useEffect(() => {
    Promise.all([api.companies.get(id), api.capTable.get(id, { diluted })])
      .then(([c, ct]) => {
        setCompany(c);
        setCapTable(ct);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id, diluted]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.companies.delete(id);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
      setShowDelete(false);
    }
  }

  if (loading) return <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading company data...</p>;
  if (error) return <p style={{ color: 'var(--neg)', fontSize: '14px' }}>{error}</p>;
  if (!company || !capTable) return null;

  const totalShares = Number(capTable.total_shares);

  // Build donut chart data from holdings
  const donutSlices = capTable.holdings.map((h, i) => ({
    pct: Number(h.percentage),
    // Non-null assertion is sound: i % COLORS.length always indexes the non-empty array.
    color: COLORS[i % COLORS.length]!,
    label: h.stakeholder_name,
  }));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Delete Modal */}
      {showDelete && (
        <DeleteCompanyModal
          companyName={company.name_en}
          onCancel={() => { setShowDelete(false); }}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      {/* Header Section */}
      <div>
        <div style={{ marginBottom: '24px' }}>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s ease' }}>
            ← Back to Dashboard
          </Link>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ 
              display: 'inline-block', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', 
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', 
              padding: '4px 8px', borderRadius: '4px', marginBottom: '12px', border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              {company.entity_type}
            </span>
            <h1 data-ghost="app_captable_headline" style={{ fontSize: '34px', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
              {company.name_en}
            </h1>
            {company.name_ar && <p style={{ fontSize: '16px', color: 'var(--text-secondary)', direction: 'rtl' }}>{company.name_ar}</p>}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowDelete(true)}
              style={{
                background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '10px 16px', fontSize: '13px',
                color: '#ef4444', cursor: 'pointer', fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
            >
              Delete
            </button>
            <Link href={`/companies/${id}/stakeholders/new`} className="btn-primary" style={{
              textDecoration: 'none',
              padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
            }}>
              + Add stakeholder
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Pills */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Cap table', href: `#cap-table`, active: true },
          { label: 'Stakeholders', href: `/companies/${id}/stakeholders`, active: false },
          { label: 'Events', href: `/companies/${id}/cap-table/events`, active: false },
          { label: 'ESOP', href: `/companies/${id}/esop`, active: false },
          { label: 'Instruments', href: `/companies/${id}/instruments`, active: false },
          { label: 'Filings', href: `/companies/${id}/filings`, active: false },
          { label: 'Signing', href: `/companies/${id}/signing`, active: false },
          { label: 'Members', href: `/companies/${id}/members`, active: false },
        ].map(({ label, href, active }) => (
          <Link key={label} href={href} style={{
            padding: '8px 16px', background: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            border: `1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
            borderRadius: '24px', color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '13px', fontWeight: active ? 500 : 400, textDecoration: 'none', transition: 'all 0.2s ease'
          }}>
            {label}
          </Link>
        ))}
      </div>

      {/* Capital Summary Stats */}
      <div data-ghost="app_captable_summary" className="glass-panel" style={{
        padding: 0, overflow: 'hidden', display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1px', background: 'var(--glass-border)',
      }}>
        <div style={{ background: 'var(--glass-bg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Paid-up capital</span>
          <span style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {company.paid_up_capital ? formatSAR(company.paid_up_capital) : '—'}
          </span>
        </div>
        <div style={{ background: 'var(--glass-bg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total shares</span>
          <span style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {totalShares > 0 ? formatNumber(totalShares) : '—'}
          </span>
        </div>
        <div style={{ background: 'var(--glass-bg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Par value</span>
          <span style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {/* 4 fraction digits matches the backend's Numeric(_, 4) wire format. */}
            {company.par_value_per_share
              ? formatSAR(company.par_value_per_share, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
              : '—'}
          </span>
        </div>
        <div style={{ background: 'var(--glass-bg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CR number</span>
          <span style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {company.cr_number ?? '—'}
          </span>
        </div>
      </div>

      {/* Ownership Chart + Cap Table */}
      <div id="cap-table" data-ghost="app_captable_holdings" className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Cap table</h2>
            {/* Issued / Fully diluted toggle */}
            <div style={{ display: 'inline-flex', padding: '3px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
              {([
                { v: false, label: 'Issued' },
                { v: true,  label: 'Fully diluted' },
              ] as const).map(opt => (
                <button
                  key={String(opt.v)}
                  type="button"
                  onClick={() => setDiluted(opt.v)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: diluted === opt.v ? 'var(--brand-purple-subtle)' : 'transparent',
                    color: diluted === opt.v ? 'var(--brand-purple-hover)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {diluted && capTable.total_shares_diluted && capTable.total_shares_issued && (
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                Issued {formatNumber(capTable.total_shares_issued)} · Diluted {formatNumber(capTable.total_shares_diluted)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href={`/companies/${id}/cap-table/transfer`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}>
              Transfer
            </Link>
            <Link href={`/companies/${id}/cap-table/capital-increase`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}>
              Capital increase
            </Link>
            <Link href={`/companies/${id}/cap-table/reduce`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}>
              Reduce
            </Link>
            <Link href={`/companies/${id}/cap-table/split`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}>
              Split
            </Link>
            <Link href={`/companies/${id}/cap-table/round-modeler`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}>
              Round modeler
            </Link>
            <Link href={`/companies/${id}/cap-table/waterfall`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}>
              Waterfall
            </Link>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, cursor: exporting ? 'wait' : 'pointer' }}
            >
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
            <button
              onClick={handleAuditPack}
              disabled={packing}
              style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, cursor: packing ? 'wait' : 'pointer' }}
            >
              {packing ? 'Building…' : 'Audit pack'}
            </button>
            <Link href={`/companies/${id}/cap-table/issue`} className="link-accent" style={{ fontSize: '14px', textDecoration: 'none', fontWeight: 500 }}>
              Issue shares
            </Link>
          </div>
        </div>

        {capTable.holdings.length === 0 ? (
          <div style={{ padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '300px' }}>No shares issued yet. Build your cap table by adding stakeholders and issuing equity.</p>
            <Link href={`/companies/${id}/cap-table/issue`} className="link-accent" style={{ fontSize: '14px', textDecoration: 'none', fontWeight: 500 }}>
              Issue shares to your first stakeholder →
            </Link>
          </div>
        ) : (
          <>
            {/* Ownership Donut */}
            <div style={{ padding: '32px 24px', display: 'flex', alignItems: 'center', gap: '48px', borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
              <DonutChart slices={donutSlices} size={120} onHover={setHoveredSlice} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: '240px' }}>
                {donutSlices.map((s, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '12px',
                      opacity: hoveredSlice === null || hoveredSlice === i ? 1 : 0.4,
                      transform: hoveredSlice === i ? 'translateX(8px)' : 'none',
                      transition: 'all 0.3s ease',
                      cursor: 'default'
                    }}
                    onMouseEnter={() => setHoveredSlice(i)}
                    onMouseLeave={() => setHoveredSlice(null)}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: s.color, flexShrink: 0, boxShadow: hoveredSlice === i ? `0 0 12px ${s.color}` : 'none', transition: 'all 0.3s ease' }} />
                    <span style={{ fontSize: '14px', color: hoveredSlice === i ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1, fontWeight: hoveredSlice === i ? 600 : 400 }}>{s.label}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Holdings Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr>
                    <th style={thData}>Stakeholder</th>
                    <th style={{ ...thData, textAlign: 'right' }}>Share class</th>
                    <th style={{ ...thData, textAlign: 'right' }}>Shares</th>
                    <th style={{ ...thData, textAlign: 'right' }}>Ownership</th>
                    <th style={{ ...thData, textAlign: 'right' }}>Allocation</th>
                    <th style={{ ...thData, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {capTable.holdings.map((h, index) => {
                    const isSynthetic = !!h.synthetic;
                    const badgeColor =
                      h.synthetic === 'esop_pool' ? 'var(--info)' :
                      h.synthetic === 'esop_grants' ? 'var(--warn)' :
                      h.synthetic === 'convertible' ? 'var(--brand-purple)' :
                      'var(--text-tertiary)';
                    const badgeLabel =
                      h.synthetic === 'esop_pool' ? 'ESOP POOL' :
                      h.synthetic === 'esop_grants' ? 'ESOP GRANTS' :
                      h.synthetic === 'convertible' ? 'CONVERTIBLE' : '';
                    return (
                    <tr
                      key={`${h.stakeholder_id ?? `synth-${h.synthetic}-${index}`}-${h.share_class}`}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: hoveredSlice === index ? 'rgba(255,255,255,0.02)' : 'transparent',
                        transition: 'background 0.2s ease',
                        borderLeft: isSynthetic ? `2px dashed ${badgeColor}` : 'none',
                      }}
                      onMouseEnter={() => setHoveredSlice(index)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    >
                      <td style={tdData}>
                        {isSynthetic ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255,255,255,0.04)',
                              color: badgeColor,
                              fontFamily: 'var(--font-mono)',
                            }}>{badgeLabel}</span>
                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{h.stakeholder_name}</span>
                          </span>
                        ) : (
                          <Link
                            href={`/companies/${id}/stakeholders/${h.stakeholder_id}`}
                            style={{ fontWeight: 500, color: 'var(--text-primary)', textDecoration: 'none', transition: 'color 0.2s ease' }}
                          >
                            {h.stakeholder_name}
                          </Link>
                        )}
                      </td>
                      <td style={{ ...tdData, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {h.share_class}
                      </td>
                      <td style={{ ...tdData, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatNumber(h.quantity)}
                      </td>
                      <td style={{ ...tdData, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {Number(h.percentage).toFixed(2)}%
                      </td>
                      <td style={{ ...tdData, textAlign: 'right' }}>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', width: '100px', overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle' }}>
                          <div style={{
                            height: '100%',
                            background: isSynthetic ? badgeColor : COLORS[index % COLORS.length],
                            borderRadius: '3px',
                            width: `${Math.min(Number(h.percentage), 100)}%`,
                            boxShadow: hoveredSlice === index ? `0 0 8px ${isSynthetic ? badgeColor : COLORS[index % COLORS.length]}` : 'none',
                            transition: 'all 0.3s ease',
                            opacity: isSynthetic ? 0.6 : 1,
                          }} />
                        </div>
                      </td>
                      <td style={{ ...tdData, textAlign: 'right' }}>
                        {isSynthetic ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-disabled)', fontStyle: 'italic' }}>—</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
                            <Link
                              href={`/companies/${id}/cap-table/issue?stakeholder=${h.stakeholder_id}`}
                              style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}
                              title="Issue more shares"
                            >
                              Issue
                            </Link>
                            <Link
                              href={`/companies/${id}/cap-table/transfer?from=${h.stakeholder_id}`}
                              style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}
                              title="Transfer shares"
                            >
                              Transfer
                            </Link>
                            <Link
                              href={`/companies/${id}/cap-table/reduce?stakeholder=${h.stakeholder_id}`}
                              style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}
                              title="Reduce / Buyback shares"
                            >
                              Reduce
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textAlign: 'center', opacity: 0.6 }}>
        DRAFT — Review all cap table data with legal counsel before relying on it for legal purposes.
      </p>
    </div>
  );
}
