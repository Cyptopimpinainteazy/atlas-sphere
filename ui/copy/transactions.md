# Transactions UI Copy

Microcopy and text content for the Atlas Sphere transaction management interface.

## Page Header

**Main Title**: "Transactions"  
*Context: Primary page heading*

**Subtitle**: "View and manage your transaction history across EVM and SVM"  
*Context: Brief description of transaction management*

**Filter Controls**:
- "All Transactions" / "EVM" / "SVM" / "Cross-VM" (tabs)
- "Time Range: Last 7 days" (dropdown)
- "Status: All" / "Success" / "Failed" / "Pending" (dropdown)
- "Amount: All" (slider/input)

**Why this matters**: Clear filtering helps users find specific transactions quickly.

## Transaction List

**List Header**:
- "Type" | "Asset" | "Amount" | "From/To" | "Status" | "VM" | "Time"

**Transaction Items**:

### EVM Transaction
**Type**: "Send" (badge)  
**Asset**: "ATLAS"  
**Amount**: "-1,000 ATLAS"  
**From**: "0x1234...5678"  
**To**: "0xabcd...ef01"  
**Status**: "✅ Confirmed"  
**VM**: "EVM" (badge)  
**Time**: "2 minutes ago"  
**Actions**: ["View Details", "View on Explorer"]

### SVM Transaction
**Type**: "Program Call" (badge)  
**Asset**: "ATLAS"  
**Amount**: "+500 ATLAS"  
**From**: "Program 0x9876...5432"  
**To**: "Account 0x1111...2222"  
**Status**: "✅ Success"  
**VM**: "SVM" (badge)  
**Time**: "5 minutes ago"  
**Actions**: ["View Details", "View on Explorer"]

### Cross-VM Transaction
**Type**: "Atomic Swap" (badge)  
**Asset**: "ATLAS/USDC"  
**Amount**: "1,000 ATLAS ↔ 1,100 USDC"  
**From**: "0x1234...5678"  
**To**: "0xabcd...ef01"  
**Status**: "✅ Completed"  
**VM**: "Cross-VM" (badge)  
**Time**: "10 minutes ago"  
**Actions**: ["View Cross-VM Details", "View Atomic Execution", "View on Explorer"]

**Why this matters**: Clear transaction presentation helps users understand their activity across all VM types.

## Transaction Details

### EVM Transaction Details

**Transaction Info**:
- **Hash**: "0xabcd...ef01"
- **Block**: "#45,672"
- **From**: "0x1111...2222"
- **To**: "0x3333...4444"
- **Value**: "1,000 ATLAS"
- **Gas Used**: "21,000"
- **Gas Price**: "10 Gwei"
- **Status**: "✅ Confirmed"

**Contract Interaction**:
- **Contract**: "Counter (0x5555...6666)"
- **Function**: "increment()"
- **Parameters**: "None"
- **Events**: ["Increment(42)"]

**Raw Data**:
- **Input Data**: "0x12345678..."
- **Output Data**: "0x00000000..."
- **Logs**: 2 events

**Why this matters**: Detailed EVM transaction information helps users understand exactly what happened.

### SVM Transaction Details

**Transaction Info**:
- **Signature**: "5abc123def456"
- **Slot**: "123,456"
- **From**: "Account 0x1111...2222"
- **To**: "Program 0x9876...5432"
- **Compute Units**: "25,000"
- **Status**: "✅ Success"

**Program Interaction**:
- **Program**: "counter_program"
- **Instruction**: "increment"
- **Accounts**: 3 accounts modified
- **Logs**: "Counter incremented to 43"

**Raw Data**:
- **Instruction Data**: "base64_encoded_data..."
- **Account Data**: "modified_account_states..."

**Why this matters**: SVM transaction details show program execution and account modifications.

### Cross-VM Transaction Details

**Atomic Execution**:
- **Transaction Hash**: "0x1234...5678"
- **Atomic ID**: "atom_789abc..."
- **Total Gas**: "195,000"
- **Total Compute Units**: "75,000"
- **Execution Time**: "2.3 seconds"

**EVM Side**:
- **Contract**: "AtomicSwap (0xabcd...1234)"
- **Function**: "executeSwap()"
- **Gas Used**: "120,000"
- **Status**: "✅ Success"
- **Events**: ["SwapExecuted", "AssetTransferred"]

**SVM Side**:
- **Program**: "swap_program (0x5678...abcd)"
- **Instruction**: "execute_swap"
- **Compute Units**: "75,000"
- **Status**: "✅ Success"
- **Logs**: "Swap completed successfully"

**Canonical Ledger**:
- **State Root**: "0xabc123..."
- **Asset Sync**: "✅ Synchronized"
- **Balance Updates**: "EVM: -1000 ATLAS, SVM: +1000 ATLAS"
- **Atomic Commit**: "✅ Verified"

**Why this matters**: Cross-VM details are unique to Atlas Sphere and require comprehensive presentation.

## Transaction Status

### Status Types

**Success States**:
- "✅ Confirmed" (EVM)
- "✅ Success" (SVM)
- "✅ Completed" (Cross-VM)
- "✅ Finalized"

**Pending States**:
- "⏳ Pending" (general)
- "⏳ Processing" (EVM)
- "⏳ Executing" (SVM)
- "⏳ Atomic Commit" (Cross-VM)

**Failed States**:
- "❌ Failed" (general)
- "❌ Reverted" (EVM)
- "❌ Error" (SVM)
- "❌ Atomic Failure" (Cross-VM)

**Why this matters**: Clear status indicators help users understand transaction state.

### Status Details

**Confirmation Levels**:
- "1/12 confirmations"
- "Finalized" (after 2 blocks)
- "Safe" (after 6 blocks)

**Error Messages**:
- "Out of gas"
- "Insufficient funds"
- "Contract execution failed"
- "Cross-VM synchronization error"

**Retry Options**:
- "Retry Transaction"
- "Speed Up" (increase gas price)
- "Cancel Transaction"

**Why this matters**: Detailed status information helps users take appropriate action.

## Search & Filter

**Search Functionality**:
- **Search Placeholder**: "Search by hash, address, or contract..."
- **Quick Filters**: 
  - "My Transactions"
  - "Contract Calls"
  - "Cross-VM Operations"
  - "Failed Transactions"

**Advanced Filters**:
- **Date Range**: "Custom range" / "Last 24h" / "Last 7 days" / "Last 30 days"
- **Amount Range**: Min/Max ATLAS amount
- **Gas Range**: Min/Max gas used
- **VM Type**: "All" / "EVM only" / "SVM only" / "Cross-VM only"
- **Status**: "All" / "Success" / "Failed" / "Pending"

**Filter Results**:
- "Showing 23 of 156 transactions"
- "No transactions match your filters"
- "Filters applied: EVM, Last 7 days, Success only"

**Why this matters**: Comprehensive filtering helps users find specific transactions efficiently.

## Transaction Actions

### Available Actions

**View Actions**:
- "View Details" (opens transaction modal)
- "View on Explorer" (external link)
- "View Contract" (if applicable)
- "Download Receipt" (JSON/PDF)

**Transaction Management**:
- "Resend Transaction" (for failed tx)
- "Speed Up" (increase priority fee)
- "Cancel Transaction" (for pending tx)
- "Copy Hash" (copy to clipboard)

**Cross-VM Specific**:
- "View Atomic Execution"
- "View State Synchronization"
- "Download Cross-VM Receipt"
- "Verify Atomic Commit"

**Why this matters**: Available actions help users manage and troubleshoot transactions.

### Action States

**Enabled Actions**:
- Normal button styling
- Clear action labels
- Tooltip descriptions

**Disabled Actions**:
- Grayed out styling
- Hover states explaining why disabled
- Examples: "Cannot resend finalized transaction"

**Loading Actions**:
- Spinner animation
- "Processing..." text
- Button disabled during execution

**Why this matters**: Clear action states prevent user confusion and guide appropriate actions.

## Transaction Statistics

**Summary Cards**:
- **Total Transactions**: "156"
- **This Month**: "23"
- **Success Rate**: "98.7%"
- **Cross-VM Operations**: "12"

**Spending Overview**:
- **Pending**: "2 transactions"
- **Total Pending Value**: "2,500 ATLAS"
- **Estimated Completion**: "~3 minutes"

**Cost Summary**:
- **Total Gas Spent**: "1.2M gas"
- **Total Fees**: "0.156 ATLAS"
- **Average Fee**: "0.001 ATLAS"
- **This Month**: "0.023 ATLAS"

**Why this matters**: Statistics help users understand their transaction patterns and costs.

## Bulk Operations

**Bulk Selection**:
- "Select All" (checkbox)
- "Select None" (checkbox)
- Individual item checkboxes
- "Selected: 5 transactions"

**Bulk Actions**:
- "Export Selected" (CSV/JSON)
- "Resend Failed" (for failed transactions)
- "Download Receipts" (batch)
- "Clear Selection"

**Bulk Filtering**:
- "Show Failed Only"
- "Show Cross-VM Only"
- "Show This Week Only"

**Why this matters**: Bulk operations improve efficiency for users with many transactions.

## Empty States

### No Transactions
**Title**: "No Transactions Yet"  
**Description**: "Your transaction history will appear here once you start using Atlas Sphere"  
**Actions**: ["Send Assets", "Deploy Contract", "Get Test Tokens"]  
**Context**: "Connect your wallet to view transaction history"

### No Search Results
**Title**: "No Matching Transactions"  
**Description**: "No transactions match your current search or filter criteria"  
**Actions**: ["Clear Filters", "Try Different Search", "View All Transactions"]  
**Context**: "Try adjusting your search terms or filters"

### Network Error
**Title**: "Unable to Load Transactions"  
**Description**: "There was a problem fetching your transaction history"  
**Actions**: ["Retry", "Check Network Status", "Contact Support"]  
**Context**: "Please check your internet connection"

**Why this matters**: Helpful empty states guide users toward next actions.

## Loading States

**Page Loading**:
- "Loading transaction history..."
- Skeleton list items
- Loading spinners

**Search Loading**:
- "Searching transactions..."
- Progress indicator for large result sets

**Action Loading**:
- "Processing transaction..."
- "Resending transaction..."
- "Downloading receipts..."

**Why this matters**: Clear loading states prevent user confusion during operations.

## Error States

### Transaction Errors

**Network Error**:
- "Unable to connect to network"
- "Please check your internet connection"
- Action: "Retry Connection"

**Transaction Not Found**:
- "Transaction not found"
- "The requested transaction may not exist or has been pruned"
- Action: "View Latest Transactions"

**Permission Error**:
- "Unable to access transaction"
- "This transaction is private or restricted"
- Action: "Contact Support"

**Why this matters**: Specific error messages help users understand and resolve issues.

## Export & Download

### Export Options

**Export Formats**:
- "CSV" (for spreadsheet applications)
- "JSON" (for developers)
- "PDF" (for formal records)
- "Excel" (for business use)

**Export Content**:
- "Transaction Details" (hash, amount, time, status)
- "Raw Data" (input/output, logs, events)
- "Cross-VM Data" (atomic execution details)
- "Receipts" (formal transaction receipts)

**Export Filters**:
- "Current View" (filtered results)
- "All Transactions" (complete history)
- "Selected Only" (bulk selection)

**Why this matters**: Export functionality helps users maintain records and analyze transaction data.

## Integration & Sharing

### Sharing Options

**Share Transaction**:
- "Copy Link" (shareable URL)
- "Share on Social" (Twitter, etc.)
- "Send to Email" (transaction receipt)

**Explorer Integration**:
- "View on Atlas Explorer"
- "View on Etherscan" (if applicable)
- "View on Solana Explorer" (if applicable)

**Why this matters**: Sharing options facilitate collaboration and verification.

## Help & Support

### Quick Help

**Transaction Guide**:
- "📚 Understanding Transaction Status"
- "🔍 How to Read Transaction Details"
- "⚡ Speeding Up Transactions"
- "🛠️ Troubleshooting Failed Transactions"

**Cross-VM Help**:
- "What is Cross-VM Execution?"
- "Understanding Atomic Transactions"
- "Cross-VM Transaction States"

**Support Options**:
- "Contact Support"
- "Report Issue"
- "Transaction Support"
- "Network Status"

**Why this matters**: Accessible help reduces support burden and improves user experience.

---

*This microcopy ensures users can effectively manage and understand their transaction history across all VM types in Atlas Sphere.*
