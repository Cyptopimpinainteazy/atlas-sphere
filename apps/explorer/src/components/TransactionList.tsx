/*! Enhanced TransactionList component with dark mode and responsive design – see comments below */
'use client';

import React from 'react';
import useSWR from 'swr';

/**
 * API fetcher – minimal wrapper around fetch
 */
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'success' | 'failed';
  vm: 'EVM' | 'SVM';
}

export default function TransactionList() {
  // SWR hook with refresh every 10s
  const { data: transactions, error, isLoading } = useSWR<
    Record<string, Transaction>
  >('/api/blockchain?type=transactions', fetcher, {
    refreshInterval: 10000,
  });

  // Helpers: format relative time, color utilities, and icon
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    return `${mins} min ago`;
  };
  const statusColor = (s: string) =>
    s === 'success' ? 'text-green-600' : 'text-red-600';
  const vmColor = (v: string) =>
    v === 'EVM'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-purple-100 text-purple-800';
  const statusIcon = (s: string) => (s === 'success' ? '✓' : '✗');

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-red-500">Failed to load transactions</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
      <header className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-4">
        <h3 className="text-lg font-semibold">Recent Transactions</h3>
        <p className="text-sm">EVM + SVM activity</p>
      </header>
      <ul className="divide-y divide-gray-200">
        {transactions?.map((tx: Transaction) => (
          <li
            key={tx.hash}
            className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${vmColor(
                  tx.vm
                )}`}>
                  {tx.vm}
                </span>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {tx.hash.slice(0, 20)}…
                  </span>
                  <span className="text-sm text-gray-500 truncate">
                    From: {tx.from.slice(0, 10)}…{tx.from.slice(-8)}
                  </span>
                  <span className="text-sm text-gray-500 truncate">
                    To: {tx.to.slice(0, 10)}…{tx.to.slice(-8)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {tx.value}
                </span>
                <span className={`text-sm ${statusColor(tx.status)}`}>
                  {statusIcon(tx.status)} {tx.status}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(tx.timestamp)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
