import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'GoMAil — Plan. Deliver. Observe.',
    template: '%s · GoMAil',
  },
  description:
    'GoMAil is a professional email campaign orchestration and delivery platform. Plan your campaigns, deliver to recipients, and observe real delivery state.',
  keywords: ['email campaigns', 'email delivery', 'campaign management', 'email orchestration'],
  authors: [{ name: 'GoMAil' }],
  openGraph: {
    type: 'website',
    siteName: 'GoMAil',
    title: 'GoMAil — Plan. Deliver. Observe.',
    description: 'Professional email campaign orchestration and delivery platform.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
