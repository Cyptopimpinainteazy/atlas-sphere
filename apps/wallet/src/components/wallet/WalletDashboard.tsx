'use client';

import { useWalletStore } from '@/stores/walletStore';
import { Sidebar } from './Sidebar';
import { Dashboard } from './views/Dashboard';
import { SendView } from './views/SendView';
import { ReceiveView } from './views/ReceiveView';
import { SwapView } from './views/SwapView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { ComitView } from './views/ComitView';

export function WalletDashboard() {
  const { activeView } = useWalletStore();

  const renderView = () => {
    switch (activeView) {
      case 'send':
        return <SendView />;
      case 'receive':
        return <ReceiveView />;
      case 'swap':
        return <SwapView />;
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
      case 'comit':
        return <ComitView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {renderView()}
      </main>
    </div>
  );
}
