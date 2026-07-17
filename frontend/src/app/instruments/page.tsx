import { MarketingFeaturePage } from '@/components/MarketingFeaturePage';

export default function InstrumentsPage() {
  return (
    <MarketingFeaturePage
      ghostPrefix="instruments_page"
      badge="Instruments"
      headline={<>Every equity instrument,<br />modeled correctly</>}
      sub="From ordinary shares to convertible sukuk — model every instrument your company might issue. See real-time dilution impact before you commit to any round."
      features={[
        {
          title: 'Ordinary shares',
          desc: 'Track founder shares, investor shares, and multi-class structures with per-class voting rights and liquidation preferences.',
          icon: '◇',
        },
        {
          title: 'Convertible notes',
          desc: 'Model valuation caps, discount rates, and trigger events. See exactly how each note converts at different round valuations.',
          icon: '◈',
        },
        {
          title: 'Warrants',
          desc: 'Issue warrants with strike prices, expiry dates, and anti-dilution provisions. Track exercise status in real time.',
          icon: '⬡',
        },
        {
          title: 'ESOP options',
          desc: 'Options granted under your CMA-compliant ESOP plan, including unvested, vested, exercised, and expired status.',
          icon: '◆',
        },
      ]}
      cta={{
        heading: 'Model your round before you close it',
        sub: 'See who owns what, fully diluted, before any term sheet is signed.',
      }}
    />
  );
}
