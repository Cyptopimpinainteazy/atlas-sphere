import { useState, Component, ErrorInfo, ReactNode } from "react";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { SecurityWrapper } from "./components/SecurityWrapper";
import Layout from "./components/Layout";
import ConnectPage from "./pages/ConnectPage";
import DashboardPage from "./pages/DashboardPage";
import SendPage from "./pages/SendPage";
import ReceivePage from "./pages/ReceivePage";
import AssetsPage from "./pages/AssetsPage";
import MasternodesPage from "./pages/MasternodesPage";
import DexPage from "./pages/DexPage";
import SettingsPage from "./pages/SettingsPage";

// Error boundary to catch React errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{children: ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-lg p-8 max-w-lg">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-300 mb-4">{this.state.error?.message}</p>
            <pre className="bg-gray-950 p-4 rounded text-xs text-gray-400 overflow-auto max-h-64">
              {this.state.error?.stack}
            </pre>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function WalletApp() {
  const wallet = useWallet();
  const [currentPage, setCurrentPage] = useState("dashboard");

  // Show connect page if not connected
  if (!wallet.connected) {
    return <ConnectPage />;
  }

  // Render current page
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "send":
        return <SendPage />;
      case "receive":
        return <ReceivePage />;
      case "assets":
        return <AssetsPage />;
      case "masternodes":
        return <MasternodesPage />;
      case "dex":
        return <DexPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <SecurityWrapper>
          <WalletApp />
        </SecurityWrapper>
      </WalletProvider>
    </ErrorBoundary>
  );
}

export default App;
