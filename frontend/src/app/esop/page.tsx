import { MarketingFeaturePage } from '@/components/MarketingFeaturePage';

export default function ESOPPage() {
  return (
    <MarketingFeaturePage
      ghostPrefix="esop_page"
      badge="ESOP"
      headline={<>Employee equity,<br />done right</>}
      sub="CMA-compliant ESOP plans for Saudi companies. Model vesting schedules, track grant status, and give employees a clear view of what they've earned."
      features={[
        {
          title: 'CMA ESOP framework',
          desc: 'Plans structured around Capital Market Authority guidelines for Saudi joint stock companies — not US 83(b) elections.',
          icon: '◈',
        },
        {
          title: 'Flexible vesting',
          desc: 'Time-based, milestone-based, or hybrid vesting. Cliff periods, acceleration triggers, and leave-of-absence clauses all supported.',
          icon: '◇',
        },
        {
          title: 'Grant letters',
          desc: 'Generate bilingual (EN/AR) grant agreement documents ready for signature. Watermarked for legal review before execution.',
          icon: '⬡',
        },
        {
          title: 'Employee portal',
          desc: 'Employees see their grant, vesting timeline, and exercisable options. No spreadsheets, no confusion.',
          icon: '◆',
        },
      ]}
      cta={{
        heading: 'Set up your first ESOP plan',
        sub: 'Model your pool size, vesting schedule, and dilution impact before issuing a single grant.',
      }}
    />
  );
}
