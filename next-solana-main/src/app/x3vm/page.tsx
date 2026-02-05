/**
 * X3VM Page - Atlas Sphere Virtual Machine Interface
 */

import { X3VMDashboard } from '@/components/x3vm/X3VMDashboard';

export const metadata = {
  title: 'X3VM - Atlas Sphere Virtual Machine',
  description: 'Deploy and execute X3 bytecode programs on Solana with EVM/SVM cross-chain capabilities',
};

export default function X3VMPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl">
      <X3VMDashboard />
    </main>
  );
}
