'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Block {
  number: number;
  hash: string;
  timestamp: number;
  transactions: number;
}

export default function BlockList() {
  const { data: blocks, error, isLoading } = useSWR('/api/blockchain?type=blocks', fetcher, {
    refreshInterval: 10000 // Refresh every 10 seconds
  });

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    return `${minutes} min ago`;
  };

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500">Failed to load blocks</div>
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
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Blocks</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Latest blocks processed by the Atlas Sphere network</p>
      </div>
      <ul className="divide-y divide-gray-200">
        {blocks?.map((block: Block) => (
          <li key={block.number}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                      <span className="text-white text-sm font-bold">#{block.number.toString().slice(-3)}</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">Block #{block.number.toLocaleString()}</div>
                    <div className="text-sm text-gray-500">{block.hash.slice(0, 20)}...</div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-sm text-gray-900">{block.transactions} txns</div>
                  <div className="text-sm text-gray-500">{formatTime(block.timestamp)}</div>
                </div>
              </div>
              <div className="mt-2 sm:flex sm:justify-between">
                <div className="sm:flex">
                  <div className="flex items-center text-sm text-gray-500">
                    Gas Used: Pending
                  </div>
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                  <button className="text-blue-600 hover:text-blue-500">
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}