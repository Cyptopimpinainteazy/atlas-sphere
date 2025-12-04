'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const data = [
  { name: 'Jan', blocks: 400, txns: 240 },
  { name: 'Feb', blocks: 300, txns: 139 },
  { name: 'Mar', blocks: 200, txns: 980 },
  { name: 'Apr', blocks: 278, txns: 390 },
  { name: 'May', blocks: 189, txns: 480 },
  { name: 'Jun', blocks: 239, txns: 380 },
];

export default function NetworkStats() {
  const { data: stats, error } = useSWR('/api/blockchain?type=stats', fetcher, {
    refreshInterval: 5000 // Refresh every 5 seconds
  });

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500">Failed to load network stats</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-bold">B</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Latest Block</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats ? stats.blockNumber?.toLocaleString() : 'Loading...'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-bold">C</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Chain</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats ? stats.chain : 'Loading...'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-bold">N</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Node Version</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats ? stats.nodeVersion : 'Loading...'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Block Production</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="blocks" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Volume</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="txns" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Dual VM Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center p-4 border rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <div>
              <p className="font-medium">EVM Adapter</p>
              <p className="text-sm text-gray-500">Active - Processing transactions</p>
            </div>
          </div>
          <div className="flex items-center p-4 border rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
            <div>
              <p className="font-medium">SVM Adapter</p>
              <p className="text-sm text-gray-500">Active - Processing transactions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}