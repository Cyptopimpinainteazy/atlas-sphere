import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import ChainStatusContainer from '@/components/ChainStatusContainer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'X3 STAR Wallet - Multi-VM Crypto Wallet',
  description: 'Secure wallet for EVM, SVM, and Substrate assets on X3 STAR blockchain',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-black text-white min-h-screen`}>
        <Providers>
          <div className="p-4">
            <ChainStatusContainer />
          </div>
          {children}
        </Providers>
      </body>
    </html>
  );
}
