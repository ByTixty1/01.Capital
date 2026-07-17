'use client';

import { PageBackground } from '@/components/PageBackground';
import { useLandingEffects } from '@/hooks/useLandingEffects';
import { LANDING_CSS } from './landing-styles';
import { Logo } from '@/components/Logo';
import { useQareenStore } from '@/lib/qareen/store';

export default function LandingPage() {
  useLandingEffects();
  const summoned = useQareenStore((s) => s.summoned);
  const setSummoned = useQareenStore((s) => s.setSummoned);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <div className="lp-wrap">
        <PageBackground />

        {/* Glass lens — follows cursor, toggled via nav button. */}
        {/* Real RGB chromatic aberration is applied to text via .lp-ca-on (text-shadow) inside the rAF loop. */}
        <div id="lp-lens" className="lp-lens" data-on="0" aria-hidden="true">
          <div className="lp-lens-glass" />
          <div className="lp-lens-hi" />
          <div className="lp-lens-rim" />
        </div>

        {/* Nav */}
        <nav className="lp-nav">
          <div className="lp-brand">
            <Logo size={22} color="var(--text-primary)" />
            <div className="lp-brand-pipe" />
            <div className="lp-brand-where">Riyadh · 2026</div>
          </div>
          <div className="lp-nav-center">
            <a className="lp-nav-link" data-active="1" href="#hero">Overview</a>
            <a className="lp-nav-link" data-active="0" href="#cap-table">Cap Table</a>
            <a className="lp-nav-link" data-active="0" href="#esop">ESOP</a>
            <a className="lp-nav-link" data-active="0" href="#compliance">Compliance</a>
            <a className="lp-nav-link" data-active="0" href="#instruments">Instruments</a>
            <a className="lp-nav-link" data-active="0" href="#cta">Contact</a>
          </div>
          <div className="lp-nav-right">
            <div className="lp-nav-clock">
              <span className="lp-pair"><b id="lp-clk-rua">—</b><span>RUH</span></span>
              <span className="lp-pair"><b id="lp-clk-ldn">—</b><span>LDN</span></span>
            </div>
            <div className="lp-nav-divider" />
            <button
              type="button"
              className="lp-lang-btn"
              id="lp-lang-toggle"
              data-ghost="nav_language_toggle"
              aria-label="Toggle language"
              aria-pressed="false"
            >
              <span className="lp-lang-active" id="lp-lang-active-label">EN</span>
              <span className="lp-lang-sep">/</span>
              <span id="lp-lang-other-label">AR</span>
            </button>
            <button className="lp-lens-btn" id="lp-lens-btn" data-on="0" aria-label="Toggle lens">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="6.5" cy="6.5" r="5.5" />
                <circle cx="6.5" cy="6.5" r="2" />
              </svg>
            </button>
            {/* Qareen — summons in place on this page, see ADR-0010. */}
            <button
              type="button"
              className="lp-lens-btn"
              data-on={summoned ? '1' : '0'}
              onClick={() => setSummoned(!summoned)}
              aria-label={summoned ? 'Dismiss Qareen' : 'Open Qareen, the AI assistant'}
              title="Qareen"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
              </svg>
            </button>
            <div className="lp-nav-divider" />
            <a className="lp-nav-signin" data-ghost="nav_sign_in" href="/login">Sign in</a>
            <a className="lp-nav-cta" data-ghost="nav_get_started" href="/register">Get started</a>
          </div>
        </nav>

        {/* Left dot rail */}
        <aside className="lp-rail" aria-label="Section navigator">
          <button className="lp-dot" data-target="hero" data-active="1"><span className="lp-lbl">Overview</span></button>
          <button className="lp-dot" data-target="cap-table" data-active="0"><span className="lp-lbl">Cap Table</span></button>
          <button className="lp-dot" data-target="esop" data-active="0"><span className="lp-lbl">ESOP</span></button>
          <button className="lp-dot" data-target="compliance" data-active="0"><span className="lp-lbl">Compliance</span></button>
          <button className="lp-dot" data-target="instruments" data-active="0"><span className="lp-lbl">Instruments</span></button>
          <button className="lp-dot" data-target="cta" data-active="0"><span className="lp-lbl">Contact</span></button>
        </aside>

        {/* Hero */}
        <section className="lp-hero" id="hero">
          <div className="lp-headline" data-ghost="hero_headline">
            <span className="lp-reveal lp-eyebrow" data-ar="إدارة الملكية · جدول الرسملة">
              <span className="lp-en">Equity management · Cap table</span><span className="lp-ar" />
            </span>
            <div style={{ height: 38 }} />
            <div className="lp-line lp-reveal" data-ar="سجل مكتوب">
              <span className="lp-en">A ledger written</span><span className="lp-ar" />
            </div>
            <div className="lp-line lp-italic lp-reveal" data-ar="بلغة القانون.">
              <span className="lp-en">in the language of law.</span><span className="lp-ar" />
            </div>
            <p className="lp-sub">Equity management built on the 2023 Saudi Companies Law — SJSC, LLC, ESOP, sukuk-convertibles. Every event signed, sealed, and reproducible.</p>
          </div>
          <div className="lp-hero-foot lp-fade">
            <div className="lp-foot-cell"><b>Built in Riyadh</b>For Saudi founders, boards, and counsel</div>
            <div className="lp-foot-cell"><b>Law-grade ledger</b>Event-sourced, deterministic, auditable</div>
            <div className="lp-foot-cell"><b>Bilingual by design</b>English + Arabic, RTL native</div>
            <div className="lp-scroll-cue"><span>Scroll</span><div className="lp-scroll-arrow" /></div>
          </div>
        </section>

        {/* Cap Table / Dashboard */}
        <section className="lp-bay" id="cap-table">
          <div className="lp-bay-head lp-fade">
            <div className="lp-bay-num">02 / Cap Table</div>
            <h2 className="lp-bay-title lp-reveal" data-ar="الشركة بأكملها، في صفحة واحدة.">
              <span className="lp-en">The whole company, <em>on one page.</em></span><span className="lp-ar" />
            </h2>
          </div>
          <div className="lp-dash">
            <aside className="lp-dash-side">
              <h4>Workspace</h4>
              <div className="lp-side-list">
                <a className="lp-on" href="#"><span className="lp-side-dot" />Overview</a>
                <a href="#"><span className="lp-side-dot" />Cap table</a>
                <a href="#"><span className="lp-side-dot" />Stakeholders</a>
                <a href="#"><span className="lp-side-dot" />Instruments</a>
                <a href="#"><span className="lp-side-dot" />ESOP</a>
                <a href="#"><span className="lp-side-dot" />Filings</a>
              </div>
              <h4>Company</h4>
              <div className="lp-side-list">
                <a href="#"><span className="lp-side-dot" />Najm Logistics SJSC</a>
                <a href="#"><span className="lp-side-dot" />Nahda Studios LLC</a>
                <a href="#"><span className="lp-side-dot" />+ Add company</a>
              </div>
            </aside>
            <main className="lp-dash-main">
              <div className="lp-dash-row lp-kpis" data-ghost="captable_kpis">
                <div className="lp-kpi lp-fade" data-ghost="captable_authorized"><div className="lp-kpi-label">Authorized shares</div><div className="lp-kpi-value">10,000,000</div><div className="lp-kpi-delta"><span className="lp-pill">SJSC</span><span>Class A · ordinary</span></div></div>
                <div className="lp-kpi lp-fade" data-ghost="captable_issued"><div className="lp-kpi-label">Issued &amp; outstanding</div><div className="lp-kpi-value">7,842,500</div><div className="lp-kpi-delta"><span className="lp-pill lp-up">+ 240,000</span><span>since Q1</span></div></div>
                <div className="lp-kpi lp-fade" data-ghost="captable_diluted"><div className="lp-kpi-label">Fully diluted</div><div className="lp-kpi-value">8,612,500</div><div className="lp-kpi-delta"><span>incl. ESOP &amp; convertibles</span></div></div>
                <div className="lp-kpi lp-fade" data-ghost="captable_last_round"><div className="lp-kpi-label">Last priced round</div><div className="lp-kpi-value">42.<span style={{ color: 'var(--text-secondary)' }}>10</span><span className="lp-unit">SAR / share</span></div><div className="lp-kpi-delta"><span>Series A · Mar 2026</span></div></div>
              </div>
              <div className="lp-dash-row lp-split">
                <div className="lp-panel lp-fade" data-ghost="captable_ownership">
                  <div className="lp-panel-head">
                    <h3 className="lp-reveal" data-ar="الملكية"><span className="lp-en">Ownership</span><span className="lp-ar" /></h3>
                    <div className="lp-panel-meta">Fully diluted · SAR</div>
                  </div>
                  <div className="lp-panel-body">
                    <div className="lp-stack">
                      <div className="lp-stack-bar" data-ghost="ownership_founders"><div className="lp-who"><span className="lp-swatch" style={{ background: '#a78bfa' }} /><div>Founders<small>3 holders · ordinary</small></div></div><div className="lp-track"><div className="lp-fill" style={{ width: '46%', background: '#a78bfa' }} /></div><div className="lp-pct">46.0%</div></div>
                      <div className="lp-stack-bar" data-ghost="ownership_series_a"><div className="lp-who"><span className="lp-swatch" style={{ background: '#8b5cf6' }} /><div>Series A investors<small>4 holders · pref. A</small></div></div><div className="lp-track"><div className="lp-fill" style={{ width: '22%', background: '#8b5cf6', animationDelay: '.1s' }} /></div><div className="lp-pct">22.0%</div></div>
                      <div className="lp-stack-bar" data-ghost="ownership_seed"><div className="lp-who"><span className="lp-swatch" style={{ background: '#6d4cc6' }} /><div>Seed investors<small>9 holders · SAFE / pref.</small></div></div><div className="lp-track"><div className="lp-fill" style={{ width: '14%', background: '#6d4cc6', animationDelay: '.2s' }} /></div><div className="lp-pct">14.0%</div></div>
                      <div className="lp-stack-bar" data-ghost="ownership_esop"><div className="lp-who"><span className="lp-swatch" style={{ background: '#4d3692' }} /><div>ESOP pool<small>granted &amp; reserved</small></div></div><div className="lp-track"><div className="lp-fill" style={{ width: '10%', background: '#4d3692', animationDelay: '.3s' }} /></div><div className="lp-pct">10.0%</div></div>
                      <div className="lp-stack-bar" data-ghost="ownership_sukuk"><div className="lp-who"><span className="lp-swatch" style={{ background: '#332661' }} /><div>Sukuk convertibles<small>2 instruments · pending</small></div></div><div className="lp-track"><div className="lp-fill" style={{ width: '8%', background: '#332661', animationDelay: '.4s' }} /></div><div className="lp-pct">8.0%</div></div>
                    </div>
                  </div>
                </div>
                <div className="lp-panel lp-fade">
                  <div className="lp-panel-head">
                    <h3 className="lp-reveal" data-ar="النشاط"><span className="lp-en">Activity</span><span className="lp-ar" /></h3>
                    <div className="lp-panel-meta">Last 30 days</div>
                  </div>
                  <div className="lp-panel-body">
                    <div className="lp-feed">
                      <div className="lp-feed-item"><time className="lp-feed-time">04 May</time><div className="lp-feed-what"><span className="lp-tag">Issue</span>240,000 ordinary shares to <em>F. Al-Otaibi</em> at 42.10 SAR.</div></div>
                      <div className="lp-feed-item"><time className="lp-feed-time">28 Apr</time><div className="lp-feed-what"><span className="lp-tag">Grant</span>ESOP grant — 12,000 options to <em>Engineering · Cohort B</em>, 4-year vest.</div></div>
                      <div className="lp-feed-item"><time className="lp-feed-time">21 Apr</time><div className="lp-feed-what"><span className="lp-tag">Filing</span>MoC annual return draft prepared. Awaiting board signature.</div></div>
                      <div className="lp-feed-item"><time className="lp-feed-time">14 Apr</time><div className="lp-feed-what"><span className="lp-tag">Transfer</span>40,000 shares · <em>S. bin Khalid → Nahda Holdings</em>. Pre-emption waived.</div></div>
                      <div className="lp-feed-item"><time className="lp-feed-time">02 Apr</time><div className="lp-feed-what"><span className="lp-tag">Note</span>Sukuk convertible #2026-001 priced. Ceiling locked at 50.00 SAR.</div></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lp-panel lp-fade" data-ghost="captable_filings">
                <div className="lp-panel-head">
                  <h3 className="lp-reveal" data-ar="الإفصاحات القادمة"><span className="lp-en">Upcoming filings</span><span className="lp-ar" /></h3>
                  <div className="lp-panel-meta">MoC · CMA · ZATCA</div>
                </div>
                <div className="lp-panel-body">
                  <div className="lp-filings">
                    <div className="lp-filing lp-fade" data-ghost="filing_moc"><div className="lp-filing-date">31<small>May</small></div><div className="lp-filing-title">MoC Annual Return<small>Companies Law Art. 218 — board-signed return of share register</small></div><div className="lp-filing-due lp-warn">Due in 24 days</div></div>
                    <div className="lp-filing lp-fade" data-ghost="filing_zatca"><div className="lp-filing-date">15<small>Jun</small></div><div className="lp-filing-title">ZATCA — Zakat &amp; corporate tax<small>Q2 estimate · ledger figures auto-attached</small></div><div className="lp-filing-due">Due in 39 days</div></div>
                    <div className="lp-filing lp-fade" data-ghost="filing_cma"><div className="lp-filing-date">02<small>Jul</small></div><div className="lp-filing-title">CMA — beneficial ownership disclosure<small>Triggered by Mar 2026 share issuance</small></div><div className="lp-filing-due">Due in 56 days</div></div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </section>

        {/* ESOP */}
        <section className="lp-bay" id="esop" data-ghost="esop_section">
          <div className="lp-bay-head lp-fade">
            <div className="lp-bay-num">03 / ESOP</div>
            <h2 className="lp-bay-title lp-reveal" data-ar="مواءمة الفريق دون إرباك السجل.">
              <span className="lp-en">Align the team <em>without diluting</em> the ledger.</span><span className="lp-ar" />
            </h2>
          </div>
          <div className="lp-lawgrid">
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Plan creation</div><h3 className="lp-reveal" data-ar="مجموعات، فترات حظر، فئات."><span className="lp-en">Pools, cliffs, <em>classes.</em></span><span className="lp-ar" /></h3><p>Multiple ESOP plans, each with its own pool, cliff, and graded vesting cadence. Modeled on CMA-permissible structures, not Delaware templates.</p></article>
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Vesting engine</div><h3 className="lp-reveal" data-ar="استحقاق محدد."><span className="lp-en">Deterministic <em>vesting.</em></span><span className="lp-ar" /></h3><p>Per-grant vesting computed event-by-event. Cliff plus graded monthly. Audit-grade reproducibility on every share, every day.</p></article>
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Disclosure</div><h3 className="lp-reveal" data-ar="حزم فصلية."><span className="lp-en">Quarterly <em>packs.</em></span><span className="lp-ar" /></h3><p>CMA-aligned ESOP disclosure packs generated from the ledger. Watermarked drafts, never auto-submitted, always counsel-reviewed.</p></article>
          </div>
        </section>

        {/* Compliance */}
        <section className="lp-bay" id="compliance" data-ghost="compliance_section">
          <div className="lp-bay-head lp-fade">
            <div className="lp-bay-num">04 / Compliance</div>
            <h2 className="lp-bay-title lp-reveal" data-ar="الجوهر، لا الغلاف.">
              <span className="lp-en">The substrate, <em>not the wrapper.</em></span><span className="lp-ar" />
            </h2>
          </div>
          <div className="lp-lawgrid">
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Companies Law 2023</div><h3 className="lp-reveal" data-ar="شركة المساهمة المبسطة كما يجب."><span className="lp-en">SJSC <em>done right.</em></span><span className="lp-ar" /></h3><p>SJSC, LLC, JSC structures, share-class taxonomy, and pre-emption mechanics modeled exactly as written, not approximated from US analogs.</p></article>
            <article className="lp-lawcard lp-fade"><div className="lp-meta">CMA · ZATCA · MoC</div><h3 className="lp-reveal" data-ar="الإفصاح، منظمًا."><span className="lp-en">Disclosure, <em>structured.</em></span><span className="lp-ar" /></h3><p>A calendar of what&apos;s due, when, and to whom — drafts pre-populated from your ledger. Never auto-submitted; always counsel-reviewed.</p></article>
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Audit</div><h3 className="lp-reveal" data-ar="ثابت، قابل للتحقق."><span className="lp-en">Immutable, <em>reproducible.</em></span><span className="lp-ar" /></h3><p>Event-sourced ledger with role-based access. Every state change is signed, hashed, and forever auditable to the original board resolution.</p></article>
          </div>
        </section>

        {/* Instruments */}
        <section className="lp-bay" id="instruments" data-ghost="instruments_section">
          <div className="lp-bay-head lp-fade">
            <div className="lp-bay-num">05 / Instruments</div>
            <h2 className="lp-bay-title lp-reveal" data-ar="صكوك، سيف، خيارات — بأصول.">
              <span className="lp-en">Sukuk, SAFE, warrants — <em>natively.</em></span><span className="lp-ar" />
            </h2>
          </div>
          <div className="lp-lawgrid">
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Sukuk convertibles</div><h3 className="lp-reveal" data-ar="متوافقة مع الشريعة."><span className="lp-en">Sharia-<em>compliant.</em></span><span className="lp-ar" /></h3><p>Convertible sukuk modeled as first-class instruments — conversion ceilings, profit shares, and discharge events all explicit on the ledger.</p></article>
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Phantom · Warrants</div><h3 className="lp-reveal" data-ar="ملكية اصطناعية."><span className="lp-en">Synthetic <em>equity.</em></span><span className="lp-ar" /></h3><p>Phantom shares track value without diluting. Warrants priced and dated, expiring through the same engine the cap table runs on.</p></article>
            <article className="lp-lawcard lp-fade"><div className="lp-meta">Scenario</div><h3 className="lp-reveal" data-ar="تصور الجولة القادمة."><span className="lp-en">Model the <em>next round.</em></span><span className="lp-ar" /></h3><p>Test up-rounds, down-rounds, anti-dilution, sukuk discharge. See dilution before you sign — never after.</p></article>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-bay" id="cta" style={{ minHeight: 'auto' }}>
          <div className="lp-cta-row lp-fade">
            <div className="lp-cta-text lp-reveal" data-ar="أدر جدول ملكيتك كما يصوغه القانون.">
              <span className="lp-en">Run your cap table <em>the way the law writes it.</em></span><span className="lp-ar" />
            </div>
            <a className="lp-cta-btn" data-ghost="cta_button" href="/register">Get started <span className="lp-arrow" /></a>
          </div>
        </section>

        {/* Footer */}
        <footer className="lp-footer">
          <div>
            <h5>ZeroOne Capital</h5>
            <ul>
              <li>Riyadh, KSA</li>
              <li>hello@01.capital</li>
              <li style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 8 }}>DRAFT — review with legal counsel before reliance.</li>
            </ul>
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li><a href="#cap-table">Cap table</a></li>
              <li><a href="#esop">ESOP</a></li>
              <li><a href="#instruments">Instruments</a></li>
              <li><a href="#compliance">Compliance</a></li>
            </ul>
          </div>
          <div>
            <h5>Reference</h5>
            <ul>
              <li><a href="#">Companies Law digest</a></li>
              <li><a href="#">Glossary (EN / AR)</a></li>
              <li><a href="#">Trust &amp; residency</a></li>
            </ul>
          </div>
          <div>
            <h5>Status</h5>
            <ul>
              <li>Discovery sprint · Day 04 / 14</li>
              <li>v0.2 · 2026.05.08</li>
            </ul>
          </div>
        </footer>
      </div>
    </>
  );
}
