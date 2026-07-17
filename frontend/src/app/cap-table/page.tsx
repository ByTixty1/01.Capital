import { MarketingFeaturePage } from '@/components/MarketingFeaturePage';

export default function CapTablePage() {
  return (
    <MarketingFeaturePage
      ghostPrefix="captable_page"
      badge="Cap Table"
      headline={<>Ownership clarity,<br />at every stage</>}
      sub="A real-time cap table built around the 2023 Saudi Companies Law. Every issuance, transfer, and dilution event is recorded immutably — your ownership register is always audit-ready."
      features={[
        {
          title: 'Event-sourced ledger',
          desc: 'Every share movement is an immutable event. Current state is materialized from history — nothing is ever deleted or silently updated.',
          icon: '⬡',
        },
        {
          title: 'Fully diluted view',
          desc: 'Model ESOP pools, convertible instruments, and warrants. See post-money ownership before you sign.',
          icon: '◈',
        },
        {
          title: 'Saudi entity types',
          desc: 'LLC, SJSC, and JSC ownership structures mapped correctly — not imported from US Delaware models.',
          icon: '◇',
        },
        {
          title: 'Waterfall modeling',
          desc: 'Simulate liquidation preferences, participation caps, and pro-rata rights across all share classes.',
          icon: '◆',
        },
      ]}
      cta={{
        heading: 'Ready to bring your cap table online?',
        sub: 'Start with a free import of your existing shareholder register.',
      }}
    />
  );
}
