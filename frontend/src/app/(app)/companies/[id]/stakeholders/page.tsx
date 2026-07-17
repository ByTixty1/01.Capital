'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, StakeholderResponse } from '@/lib/api';
import { thData, tdData } from '@/lib/table-styles';

export default function StakeholdersPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const [stakeholders, setStakeholders] = useState<StakeholderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.stakeholders
      .list(companyId)
      .then(setStakeholders)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [companyId]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <Link href={`/companies/${companyId}`} style={{ color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.2s ease' }}>
          ← Back to Company
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 data-ghost="app_stakeholders_headline" style={{ fontSize: '28px', fontWeight: 400, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Stakeholders
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Individuals and entities that hold or will hold shares in this company.
          </p>
        </div>
        <Link data-ghost="app_stakeholders_add" href={`/companies/${companyId}/stakeholders/new`} className="btn-primary" style={{
          textDecoration: 'none',
          padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
        }}>
          + Add stakeholder
        </Link>
      </div>

      <div data-ghost="app_stakeholders_list">
      {loading && <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Loading stakeholders...</p>}
      {error && <p style={{ color: 'var(--neg)', fontSize: '14px' }}>{error}</p>}

      {!loading && !error && stakeholders.length === 0 && (
        <div className="glass-panel" style={{ padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>No stakeholders yet</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '320px', margin: '0 auto' }}>Add the founders and investors who hold shares in this company.</p>
          </div>
          <Link href={`/companies/${companyId}/stakeholders/new`} className="link-accent" style={{ fontSize: '14px', textDecoration: 'none', fontWeight: 500, marginTop: '8px' }}>
            Add first stakeholder →
          </Link>
        </div>
      )}

      {stakeholders.length > 0 && (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={thData}>Name</th>
                <th style={thData}>Type</th>
                <th style={thData}>Nationality / CR</th>
                <th style={thData}>Email</th>
                <th style={{ ...thData, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stakeholders.map(st => (
                <tr key={st.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <td style={tdData}>
                    <Link
                      href={`/companies/${companyId}/stakeholders/${st.id}`}
                      style={{ textDecoration: 'none', transition: 'color 0.2s ease' }}
                    >
                      <p style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{st.name_en}</p>
                      {st.name_ar && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', direction: 'rtl', marginTop: '2px' }}>{st.name_ar}</p>}
                    </Link>
                  </td>
                  <td style={tdData}>
                    <span style={{ 
                      display: 'inline-block', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', 
                      fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase', 
                      padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      {st.stakeholder_type === 'natural_person' ? 'Individual' : 'Entity'}
                    </span>
                  </td>
                  <td style={{ ...tdData, fontFamily: 'var(--font-mono)' }}>
                    {st.nationality ?? st.cr_number ?? '—'}
                  </td>
                  <td style={{ ...tdData, color: 'var(--text-secondary)' }}>
                    {st.email ?? '—'}
                  </td>
                  <td style={{ ...tdData, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <Link
                        href={`/companies/${companyId}/stakeholders/${st.id}`}
                        style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s ease' }}
                      >
                        View
                      </Link>
                      <Link
                        href={`/companies/${companyId}/cap-table/issue?stakeholder=${st.id}`}
                        className="link-accent"
                        style={{ fontSize: '13px', textDecoration: 'none', fontWeight: 500 }}
                      >
                        Issue shares
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </div>
  );
}
