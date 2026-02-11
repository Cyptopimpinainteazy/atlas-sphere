/**
 * App.tsx — root application component.
 *
 * Wraps the entire application with the ThemeProvider and renders the
 * Desktop environment with 3D scene, terminal, and UI overlay.
 * 
 * Two modes:
 *  - Normal: Just eyeball (standard users)
 *  - Exclusive: Eyeball + Pyramid + Metatron (exclusive rights holders)
 */
import React, { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { ThreeScene } from "./components/three/ThreeScene";
import { Terminal } from "./components/terminal/Terminal";
import Desktop from "./components/desktop/Desktop";
import { PerformanceMonitor } from "./components/debug/PerformanceMonitor";
import { ForegroundParallax } from "./components/effects/ForegroundParallax";
import { AppModeProvider } from "./contexts/AppModeContext";
import SalesPage from "./pages/sales";
import SocialApp from "./pages/social/SocialApp";
import CrmApp from "./pages/crm/CrmApp";

/* ── Error Boundary ────────────────────────────────────────── */

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error, info);
    // Persist to localStorage for post-mortem debugging
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      };
      const key = "atlas-desktop:error-log";
      const log = JSON.parse(localStorage.getItem(key) ?? "[]");
      log.push(entry);
      if (log.length > 50) log.splice(0, log.length - 50);
      localStorage.setItem(key, JSON.stringify(log));
    } catch {
      // Ignore storage failures during error handling
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-[#1a1a1a]">
          <div className="max-w-md p-8 text-center">
            <div className="text-4xl mb-4">⚠</div>
            <h1 className="text-lg font-bold text-[#e0e0e0] mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-[#a8a8a8] mb-4">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              className="px-4 py-2 rounded-lg bg-[#ff6b35] text-white text-sm
                font-medium hover:bg-[#ff8c42] transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
            <p className="text-[10px] text-[#666] mt-4">
              Error details have been logged for diagnostics.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ── App Component ─────────────────────────────────────────── */

const AppContent: React.FC = () => {
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Routes>
      <Route path="/sales" element={<SalesPage />} />
      <Route path="/social/*" element={<SocialApp />} />
      <Route path="/crm/*" element={<CrmApp />} />
      <Route path="*" element={
        <ThemeProvider>
          {/* Performance Monitor - Press P to toggle */}
          <PerformanceMonitor />

          {/* 3D Scene Background - behind pyramid */}
          <ThreeScene />

          {/* White glow behind pyramid */}
          <div className="pyramid-glow" aria-hidden="true" />

          {/* Background Pyramids - shadow behind main */}
          <div className="pyramid-shadow" aria-hidden="true" />
          <div className="pyramid-bg" aria-hidden="true" />

          {/* Transparent foreground overlay - makes pyramid look like it's in background */}
          {/* Responds to cursor for parallax depth effect */}
          <ForegroundParallax />

          {/* UI Overlay */}
          <div className="fixed inset-0 z-20">
            <Desktop isTerminalOpen={isTerminalOpen} onTerminalToggle={() => setIsTerminalOpen(!isTerminalOpen)} />
          </div>

          {/* Interactive Terminal */}
          <Terminal 
            isOpen={isTerminalOpen} 
            onClose={() => setIsTerminalOpen(false)} 
          />
        </ThemeProvider>
      } />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppModeProvider>
        <AppContent />
      </AppModeProvider>
    </ErrorBoundary>
  );
};

export default App;
