import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/hooks/useQuery';
import { Header, Sidebar, Footer } from '@/components/Layout';
import { DashboardOverview } from '@/components/Dashboard';
import { GpuMonitoring } from '@/components/GpuMonitoring';
import { TaskQueue } from '@/components/TaskManagement';
import { NetworkTopology } from '@/components/NetworkTopology';
import { Economics } from '@/components/Economics';
import { Governance } from '@/components/Governance';
import { Settings } from '@/components/Settings';

// Error Boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error);
    console.error('Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown error';
      const errorStack = this.state.error?.stack || 'No stack trace';
      
      return (
        <div style={{ 
          padding: '40px', 
          color: 'white', 
          backgroundColor: '#7f1d1d',
          fontFamily: 'monospace',
          height: '100vh',
          overflowY: 'auto'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '20px', color: '#fca5a5' }}>⚠️ Component Error</h1>
          <h2 style={{ fontSize: '16px', marginBottom: '10px', color: '#fecaca' }}>Message:</h2>
          <p style={{ marginBottom: '20px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px' }}>{errorMessage}</p>
          <h2 style={{ fontSize: '16px', marginBottom: '10px', color: '#fecaca' }}>Stack Trace:</h2>
          <pre style={{ 
            marginTop: '20px', 
            overflowX: 'auto', 
            fontSize: '12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            padding: '10px',
            borderRadius: '4px'
          }}>
            {errorStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#fca5a5',
              color: '#7f1d1d',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const DashboardLayout: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => {
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <Header title={title} />
        <main className="p-6">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route
              path="/"
              element={
                <DashboardLayout title="GPU Swarm Dashboard">
                  <DashboardOverview />
                </DashboardLayout>
              }
            />
            <Route
              path="/gpu"
              element={
                <DashboardLayout title="GPU Monitoring">
                  <GpuMonitoring />
                </DashboardLayout>
              }
            />
            <Route
              path="/tasks"
              element={
                <DashboardLayout title="Task Management">
                  <TaskQueue />
                </DashboardLayout>
              }
            />
            <Route
              path="/network"
              element={
                <DashboardLayout title="Network Topology">
                  <NetworkTopology />
                </DashboardLayout>
              }
            />
            <Route
              path="/economics"
              element={
                <DashboardLayout title="Economics">
                  <Economics />
                </DashboardLayout>
              }
            />
            <Route
              path="/governance"
              element={
                <DashboardLayout title="Governance">
                  <Governance />
                </DashboardLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <DashboardLayout title="Settings">
                  <Settings />
                </DashboardLayout>
              }
            />
          </Routes>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
