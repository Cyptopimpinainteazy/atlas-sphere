/**
 * Mynta Wallet - Main Entry Point
 * 
 * This file handles initialization with robust error handling and logging.
 * All errors are captured and reported to the Rust backend.
 */

// === PHASE 1: Very early error capturing (before any imports) ===
(function earlySetup() {
  console.log('[BOOT] Early setup starting...');
  
  // Create a visible error display function
  (window as any).__showFatalError = function(title: string, message: string, stack?: string) {
    console.error(`[FATAL] ${title}: ${message}`);
    document.body.innerHTML = `
      <div style="padding: 40px; font-family: system-ui; background: #1a1a2e; color: white; min-height: 100vh; box-sizing: border-box;">
        <h1 style="color: #ff6b6b; margin-bottom: 20px;">⚠️ ${title}</h1>
        <p style="font-size: 18px; margin-bottom: 20px;">${message}</p>
        ${stack ? `<pre style="background: #0d0d1a; padding: 20px; border-radius: 8px; overflow: auto; font-size: 12px; color: #888;">${stack}</pre>` : ''}
        <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 24px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Reload Application
        </button>
      </div>
    `;
  };
  
  console.log('[BOOT] Early setup complete');
})();

import React from "react";
import ReactDOM from "react-dom/client";

console.log('[BOOT] React imports loaded');

// === PHASE 2: Set up error bridges ===

// Track if we've reported ui_ready
let uiReadyReported = false;

// Report errors to Rust backend
async function reportErrorToRust(errorType: string, message: string, stack?: string) {
  try {
    // Dynamic import to avoid breaking if Tauri isn't ready
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("report_js_error", { 
      errorType, 
      message, 
      stack: stack || null 
    });
  } catch (e) {
    console.error('[ERROR BRIDGE] Failed to report to Rust:', e);
  }
}

// Signal UI is ready
async function signalUiReady() {
  if (uiReadyReported) return;
  uiReadyReported = true;
  
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("ui_ready");
    console.log('[BOOT] UI ready signal sent to Rust');
  } catch (e) {
    console.error('[BOOT] Failed to send ui_ready:', e);
  }
}

// Global error handler
window.onerror = function(message, source, lineno, colno, error) {
  const errorMsg = typeof message === 'string' ? message : 'Unknown error';
  const stack = error?.stack || `at ${source}:${lineno}:${colno}`;
  
  console.error('[GLOBAL ERROR]', errorMsg, stack);
  reportErrorToRust('window.onerror', errorMsg, stack);
  
  // Show visible error if it's a critical failure
  if (!uiReadyReported) {
    (window as any).__showFatalError('JavaScript Error', errorMsg, stack);
  }
  
  return false;
};

// Unhandled promise rejection handler
window.onunhandledrejection = function(event) {
  const reason = event.reason;
  const message = reason?.message || String(reason);
  const stack = reason?.stack || '';
  
  console.error('[UNHANDLED REJECTION]', message, stack);
  reportErrorToRust('unhandledrejection', message, stack);
  
  // Don't show fatal error for promise rejections unless critical
};

console.log('[BOOT] Error handlers installed');

// === PHASE 3: Load and render the application ===

async function initializeApp() {
  console.log('[BOOT] Initializing application...');
  
  try {
    // Import App dynamically to catch any import errors
    console.log('[BOOT] Importing App component...');
    const { default: App } = await import("./App");
    console.log('[BOOT] App component imported');
    
    // Import CSS
    console.log('[BOOT] Importing styles...');
    await import("./index.css");
    console.log('[BOOT] Styles imported');
    
    // Find root element
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Root element #root not found in DOM");
    }
    
    console.log('[BOOT] Creating React root...');
    const root = ReactDOM.createRoot(rootElement);
    
    console.log('[BOOT] Rendering App...');
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    console.log('[BOOT] React render called, scheduling ui_ready...');
    
    // Signal UI ready after a short delay to ensure React has mounted
    setTimeout(() => {
      signalUiReady();
    }, 500);
    
    // Also check after React should definitely have mounted
    setTimeout(() => {
      if (rootElement.children.length === 0) {
        console.error('[BOOT] React did not mount any children after 2 seconds');
        (window as any).__showFatalError(
          'React Failed to Mount',
          'The React application did not render properly. Check console for errors.',
          'This usually indicates a JavaScript error in the App component.'
        );
      } else {
        console.log('[BOOT] React mounted successfully with', rootElement.children.length, 'children');
      }
    }, 2000);
    
  } catch (error) {
    console.error('[BOOT] Fatal initialization error:', error);
    const err = error as Error;
    (window as any).__showFatalError(
      'Initialization Failed',
      err.message || 'Unknown error during app initialization',
      err.stack
    );
    reportErrorToRust('initialization', err.message || 'Unknown', err.stack);
  }
}

// Start initialization
console.log('[BOOT] Starting app initialization...');
initializeApp();
