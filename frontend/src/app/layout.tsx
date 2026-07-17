import type { Metadata } from 'next';
import { Montserrat, JetBrains_Mono, Instrument_Serif, Rubik } from 'next/font/google';
import './globals.css';
import { QareenPresence } from '@/components/qareen/QareenPresence';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const rubik = Rubik({
  subsets: ['latin', 'arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ar',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '01 Capital',
  description: 'Cap table and equity management for Saudi startups.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} ${rubik.variable}`}>
      <body>
        {children}
        <QareenPresence />
      </body>
    </html>
  );
}
