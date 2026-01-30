import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Header } from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Atlas DEX - Dual-VM Decentralized Exchange',
  description: 'Trade across EVM and SVM with atomic cross-chain swaps on Atlas Sphere',
  keywords: ['DEX', 'DeFi', 'EVM', 'SVM', 'Solana', 'Ethereum', 'swap', 'liquidity'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-8">
              {children}
            </main>
            <footer className="border-t border-border py-6">
              <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
                © 2025 Atlas Sphere. All rights reserved.
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
