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
      <body className="relative isolate min-h-screen font-sans antialiased">
        {/* Slowly drifting aurora glows behind everything */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
          <div className="absolute -left-[12%] -top-[18%] h-[55vh] w-[55vw] animate-drift rounded-full bg-[#7C5CFF] opacity-[0.18] blur-[120px]" />
          <div className="absolute -right-[10%] top-[10%] h-[45vh] w-[40vw] animate-drift-slow rounded-full bg-[#22D3EE] opacity-[0.10] blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[30%] h-[50vh] w-[45vw] animate-drift rounded-full bg-[#EC4899] opacity-[0.08] blur-[130px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
