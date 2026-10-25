import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import './globals.css';

const sans = Inter_Tight({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'FranchiseFlow · Franchise Onboarding Engine',
  description: 'Screens franchise applications, allocates territory slots and plans onboarding, with every decision explained.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-canvas font-sans antialiased">{children}</body>
    </html>
  );
}
