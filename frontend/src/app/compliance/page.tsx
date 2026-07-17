import { MarketingFeaturePage } from '@/components/MarketingFeaturePage';

export default function CompliancePage() {
  return (
    <MarketingFeaturePage
      ghostPrefix="compliance_page"
      badge="Compliance"
      headline={<>Built for Saudi<br />corporate law</>}
      sub="01 Capital is built around the 2023 Saudi Companies Law from the ground up — not retrofitted from foreign jurisdictions. Every cap table action is traceable, every document is watermarked for legal review."
      features={[
        {
          title: 'Article-level validation',
          desc: 'Share transfers, capital increases, and board resolutions are validated against the relevant articles of the 2023 Saudi Companies Law.',
          icon: '◇',
        },
        {
          title: 'Immutable audit log',
          desc: 'Every action is timestamped and signed by the user who took it. Nothing is edited or deleted — the record is permanent.',
          icon: '⬡',
        },
        {
          title: 'MoC-ready documents',
          desc: 'Generate formatted documents for Ministry of Commerce filings. We structure — you and your lawyer verify before submitting.',
          icon: '◈',
        },
        {
          title: 'Data residency',
          desc: 'All production data is hosted on AWS Bahrain. Saudi corporate records stay within Saudi Arabia.',
          icon: '◆',
        },
      ]}
      notice={{
        title: 'Important notice',
        body: '01 Capital is a software tool, not a law firm. All documents generated carry a "DRAFT — REVIEW WITH LEGAL COUNSEL" watermark and must be reviewed by a qualified Saudi legal advisor before use in any corporate or regulatory filing. We surface and structure — we do not provide legal advice.',
      }}
    />
  );
}
