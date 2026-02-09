import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/hooks/useQuery';

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={{
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '10px'
    }}>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>{title}</p>
      <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>{value}</p>
    </div>
  );
}

function SimpleApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{
        backgroundColor: '#020617',
        color: 'white',
        minHeight: '100vh',
        padding: '40px'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>GPU Swarm Dashboard</h1>
        <p style={{ color: '#94a3b8', marginBottom: '40px' }}>Development Test - No API calls</p>
        
        <div style={{ maxWidth: '1200px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Mock Metrics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
            <StatCard title="Tasks Submitted" value={1250} />
            <StatCard title="Tasks Completed" value={892} />
            <StatCard title="GPU Utilization" value="78.5%" />
            <StatCard title="Network Peers" value={42} />
          </div>
        </div>

        <div style={{ marginTop: '60px', padding: '20px', backgroundColor: '#1e293b', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '10px', color: '#10b981' }}>✓ Status</h3>
          <ul style={{ color: '#94a3b8', lineHeight: '1.8' }}>
            <li>✓ React is rendering</li>
            <li>✓ Components are loading</li>
            <li>✓ Styles are applied</li>
            <li>✓ No API calls (development mode)</li>
          </ul>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default SimpleApp;
