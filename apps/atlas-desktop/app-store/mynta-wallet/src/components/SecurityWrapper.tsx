/**
 * SecurityWrapper - Ready-to-use wrapper for app-wide security features
 * 
 * INTEGRATION (for UX Agent):
 * 
 * In App.tsx, wrap WalletApp with this component:
 * 
 * ```tsx
 * import SecurityWrapper from "./components/SecurityWrapper";
 * 
 * function App() {
 *   return (
 *     <ErrorBoundary>
 *       <WalletProvider>
 *         <SecurityWrapper>
 *           <WalletApp />
 *         </SecurityWrapper>
 *       </WalletProvider>
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 * 
 * This provides:
 * - Session timeout with auto-lock
 * - Session warning banner before lock
 * - Session expired modal with unlock
 * - Secure clipboard operations
 */
import { ReactNode } from 'react';
import { SecurityProvider, useSecurity } from '../context/SecurityContext';
import { SessionExpiredModal, SessionWarningBanner } from './SessionExpiredModal';

interface SecurityWrapperProps {
  children: ReactNode;
}

/**
 * Inner component that uses the security context
 */
function SecurityUI({ children }: SecurityWrapperProps) {
  const {
    showSessionExpiredModal,
    dismissSessionExpiredModal,
    unlockWallet: _unlockWallet,
    isSessionWarning,
    sessionSecondsRemaining,
    sessionTimeoutMinutes,
    resetSessionTimer,
  } = useSecurity();

  const handleUnlock = async () => {
    // The modal handles unlock internally
    dismissSessionExpiredModal();
  };

  return (
    <>
      {children}
      
      {/* Session Warning Banner */}
      {isSessionWarning && (
        <SessionWarningBanner
          secondsRemaining={sessionSecondsRemaining}
          onExtend={resetSessionTimer}
        />
      )}
      
      {/* Session Expired Modal */}
      <SessionExpiredModal
        isOpen={showSessionExpiredModal}
        onUnlock={handleUnlock}
        onClose={dismissSessionExpiredModal}
        timeoutMinutes={sessionTimeoutMinutes}
      />
    </>
  );
}

/**
 * Main wrapper component - provides SecurityProvider + UI elements
 */
export function SecurityWrapper({ children }: SecurityWrapperProps) {
  return (
    <SecurityProvider>
      <SecurityUI>{children}</SecurityUI>
    </SecurityProvider>
  );
}

export default SecurityWrapper;


