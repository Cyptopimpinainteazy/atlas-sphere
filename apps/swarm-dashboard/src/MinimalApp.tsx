import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/hooks/useQuery';
import { DashboardOverview } from '@/components/Dashboard';

console.log('Minimal App loading...');

function MinimalApp() {
  console.log('Minimal App rendering...');
  
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ backgroundColor: '#020617', color: 'white', minHeight: '100vh', padding: '20px' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>GPU Swarm Dashboard (Test)</h1>
        <p style={{ marginBottom: '20px', color: '#94a3b8' }}>Testing Dashboard Component:</p>
        <DashboardOverview />
      </div>
    </QueryClientProvider>
  );
}

export default MinimalApp;
