# Dashboard UI Copy

Microcopy and text content for the Atlas Sphere wallet dashboard interface.

## Page Header

**Main Title**: "Atlas Sphere Wallet"  
*Context: Primary page heading*

**Subtitle**: "Manage your assets across EVM and SVM with atomic cross-chain operations"  
*Context: Brief description of wallet capabilities*

**Why this matters**: Clear branding and value proposition help users understand the unique dual-VM capabilities.

## Navigation

**Navigation Items**:
- "Dashboard" (active state)
- "Portfolio" 
- "Transactions"
- "Deploy Contract"
- "Node Status"
- "Settings"

**Why this matters**: Consistent navigation helps users understand available features and move between sections easily.

## Connection Status

**Connected State**:
- Status: "🟢 Connected to Atlas Sphere"
- Network: "Testnet v1.0"
- Block: "#45,672"
- Finality: "~12s ago"

**Disconnected State**:
- Status: "🔴 Disconnected"
- Action: "Connect Wallet"
- Help text: "Connect your wallet to view balances and transactions"

**Connection Error**:
- Status: "⚠️ Connection Failed"
- Action: "Retry Connection"
- Help text: "Unable to connect to Atlas Sphere network"

**Why this matters**: Clear connection status helps users understand if their wallet is properly connected and network state.

## Quick Actions

**Action Buttons**:
- "Send Assets" → Primary action for transfers
- "Receive Assets" → Secondary action for deposits
- "Deploy Contract" → For developers
- "View All Transactions" → Transaction history

**Button States**:
- Enabled: Normal styling with clear labels
- Disabled: Grayed out with tooltip explaining requirement
- Loading: Spinner animation with "Processing..." text

**Why this matters**: Quick actions provide immediate access to common functions without navigation.

## Balance Overview

**EVM Balance**:
- Title: "EVM Assets"
- Token: "ATLAS"
- Balance: "1,234.56 ATLAS"
- USD Value: "$123.45"
- Change: "+2.3%"

**SVM Balance**:
- Title: "SVM Assets" 
- Token: "ATLAS"
- Balance: "567.89 ATLAS"
- USD Value: "$56.78"
- Change: "+1.8%"

**Total Value**:
- Title: "Total Portfolio"
- Combined: "1,802.45 ATLAS"
- USD Value: "$180.23"
- Change: "+2.1%"

**Empty State**:
- "No assets found"
- "Connect your wallet to view balances"
- Action: "Get Test Tokens"

**Why this matters**: Clear balance presentation helps users understand their portfolio across both VMs.

## Recent Activity

**Section Header**: "Recent Activity"

**Transaction Items**:
- Type: "Send" / "Receive" / "Deploy Contract"
- Asset: "ATLAS" or specific token
- Amount: "1,000.00 ATLAS"
- Timestamp: "2 minutes ago"
- Status: "✅ Confirmed" / "⏳ Pending" / "❌ Failed"
- VM Type: "EVM" / "SVM" / "Cross-VM"

**Empty State**:
- "No recent activity"
- "Your transactions will appear here"
- Action: "Make Your First Transaction"

**View All**: "View All Transactions"

**Why this matters**: Activity feed helps users track their recent actions and understand transaction status.

## Quick Stats

**Stats Cards**:
- "Total Transactions": "23"
- "Cross-VM Operations": "5"
- "Contracts Deployed": "2"
- "Network Uptime": "99.9%"

**Why this matters**: Quick stats provide insight into user activity and network health.

## Network Status

**Current Block**:
- "Latest Block: #45,672"
- "Finalized: #45,670"
- "Time to Finality: ~12s"

**Validator Status**:
- "Network Status: Healthy"
- "Active Validators: 15"
- "Next Block: ~3s"

**RPC Status**:
- "EVM RPC: 🟢 Operational"
- "SVM RPC: 🟢 Operational" 
- "WebSocket: 🟢 Connected"

**Why this matters**: Network status helps users understand blockchain health and when transactions will finalize.

## Cross-VM Features

**Feature Banner**:
- Title: "Try Cross-VM Operations"
- Description: "Move assets between EVM and SVM in atomic transactions"
- Action: "Learn More" / "Start Now"

**Cross-VM Quick Actions**:
- "Atomic Swap"
- "Cross-VM Transfer"
- "Dual Contract Call"

**Why this matters**: Highlighting unique features helps users understand Atlas Sphere's advantages.

## Help & Support

**Help Section**:
- "Need Help?" (collapsible)
- "Getting Started Guide"
- "Cross-VM Tutorial"
- "API Documentation"
- "Contact Support"

**Community Links**:
- "Join Discord"
- "GitHub Repository"
- "Developer Forum"

**Why this matters**: Easy access to help resources improves user experience and reduces support burden.

## Empty States

### No Wallet Connected
**Title**: "Connect Your Wallet"  
**Description**: "Connect a wallet to start managing your Atlas Sphere assets across EVM and SVM"  
**Actions**: ["MetaMask", "WalletConnect", "Phantom"]

### No Transactions
**Title**: "No Transactions Yet"  
**Description**: "Your transaction history will appear here once you start using Atlas Sphere"  
**Actions**: ["Send Assets", "Deploy Contract", "Get Test Tokens"]

### Network Error
**Title**: "Network Connection Issue"  
**Description**: "Unable to connect to Atlas Sphere network. Please check your connection and try again."  
**Actions**: ["Retry Connection", "Check Status", "Contact Support"]

**Why this matters**: Helpful empty states guide users toward next actions rather than showing blank pages.

## Loading States

**Page Loading**:
- "Loading Atlas Sphere Dashboard..."
- Spinner animation

**Balance Loading**:
- "Fetching balances..."
- Skeleton placeholders for balance cards

**Transaction Loading**:
- "Loading transactions..."
- Skeleton list items

**Action Loading**:
- "Processing..." with spinner
- Button disabled during processing

**Why this matters**: Clear loading states prevent user confusion and provide feedback during operations.

## Error States

**Connection Error**:
- "Unable to connect to network"
- "Please check your internet connection"
- Action: "Retry Connection"

**Balance Error**:
- "Failed to load balances"
- "Please try refreshing the page"
- Action: "Refresh"

**Transaction Error**:
- "Unable to load transactions"
- "Your recent activity may be temporarily unavailable"
- Action: "Try Again"

**Why this matters**: Helpful error messages guide users toward resolution rather than leaving them confused.

## Responsive Design

**Mobile Adjustments**:
- Simplified navigation with hamburger menu
- Stacked balance cards
- Larger touch targets for actions
- Condensed transaction list

**Tablet Adjustments**:
- Two-column layout for balances
- Larger transaction cards
- Side-by-side quick actions

**Why this matters**: Responsive design ensures good experience across all devices.

## Accessibility

**Screen Reader**:
- Proper ARIA labels for all interactive elements
- Status announcements for connection changes
- Descriptive button labels
- Clear form labels

**Keyboard Navigation**:
- Tab order follows logical flow
- All actions keyboard accessible
- Escape key closes modals
- Arrow keys navigate lists

**Visual Accessibility**:
- High contrast color scheme
- Scalable fonts and UI elements
- Focus indicators for keyboard users
- Alternative text for icons

**Why this matters**: Accessibility ensures all users can effectively use the wallet interface.

---

*This microcopy ensures consistent, helpful messaging throughout the dashboard interface while highlighting Atlas Sphere's unique dual-VM capabilities.*
