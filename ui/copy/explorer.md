# Explorer UI Copy

Microcopy and text content for the Atlas Sphere blockchain explorer interface.

## Page Header

**Main Title**: "Atlas Sphere Explorer"  
*Context: Primary page heading*

**Subtitle**: "Browse blocks, transactions, and contracts across EVM and SVM"  
*Context: Brief description of explorer functionality*

**Network Selector**:
- "Mainnet" / "Testnet" (dropdown)
- "Latest Block: #45,672"

**Why this matters**: Clear branding and network identification help users understand which blockchain they're viewing.

## Search Functionality

**Search Placeholder**: "Search by block, transaction, address, or contract..."  
*Context: Search input field*

**Search Suggestions**:
- "Block #45,672"
- "0x1234...5678 (Address)"
- "Contract: Counter"
- "TX: 0xabcd...ef01"

**Search Results**:
- "Found 3 results for '0x1234'"
- "No results found"
- "Search took 0.23s"

**Why this matters**: Effective search helps users quickly find specific blockchain data.

## Block View

**Block Header**:
- "Block #45,672"
- "Timestamp: Dec 10, 2025 2:11 PM UTC"
- "Transactions: 23"
- "Finalized: ✅ Yes"
- "Hash: 0xabcd...ef01"

**Block Details**:
- **Parent Hash**: 0x9876...5432
- **State Root**: 0x2468...1357
- **Receipts Root**: 0x1357...2468
- **Miner/Validator**: 0x1111...2222
- **Gas Used**: 1,234,567 / 15,000,000
- **Base Fee**: 10 Gwei

**Block Actions**:
- "View on EVM"
- "View on SVM"
- "View Cross-VM Operations"

**Why this matters**: Comprehensive block information helps users understand blockchain state and performance.

## Transaction View

**Transaction Header**:
- "Transaction Hash: 0xabcd...ef01"
- "Status: ✅ Success" / "❌ Failed" / "⏳ Pending"
- "Block: #45,672"
- "From: 0x1111...2222"
- "To: 0x3333...4444"

**Transaction Details**:
- **Type**: "EVM" / "SVM" / "Cross-VM"
- **Value**: "1,000 ATLAS"
- **Gas**: "21,000 used"
- **Gas Price**: "10 Gwei"
- **Nonce**: "42"
- **Timestamp**: "Dec 10, 2025 2:11 PM UTC"

**Cross-VM Transaction Details**:
- **EVM Execution**: 
  - Contract: 0x5555...6666
  - Gas Used: "150,000"
  - Status: "Success"
- **SVM Execution**:
  - Program: 0x7777...8888  
  - Compute Units: "75,000"
  - Status: "Success"
- **Atomic Result**: "Both VMs executed successfully"

**Transaction Actions**:
- "View Raw Transaction"
- "View Contract"
- "View Internal Transactions"
- "View Events"

**Why this matters**: Detailed transaction information helps users understand what happened and debug issues.

## Address View

**Address Header**:
- "Address: 0x1234...5678"
- **Type**: "EOA" / "Contract" / "Program"
- **Balance**: "1,234.56 ATLAS"
- **Transactions**: "23 sent, 45 received"

**Address Details**:
- **EVM Information**:
  - Balance: "1,000 ATLAS"
  - Token Balance: "USDC: 500.00"
  - Contract Code: "Verified ✅"
- **SVM Information**:
  - Balance: "234.56 ATLAS" 
  - Account Data: "2.3 KB"
  - Program Ownership: "None"

**Recent Activity**:
- "Last Transaction: 2 minutes ago"
- "First Transaction: 3 days ago"
- **Transaction Count**: 68 total

**Address Actions**:
- "View on EVM"
- "View on SVM"
- "Add to Watchlist"
- "Copy Address"

**Why this matters**: Address views help users track balances and activity across both VMs.

## Contract View

**Contract Header**:
- "Contract: Counter"
- "Address: 0xabcd...ef01"
- **Type**: "EVM Contract" / "SVM Program"
- **Verification**: "✅ Verified"
- "Compiler**: "Solidity v0.8.19"

**Contract Information**:
- **EVM Contract**:
  - Source Code: "Available ✅"
  - ABI: "Available ✅"
  - Bytecode: "Verified ✅"
- **SVM Program**:
  - Program ID: 0x9876...5432
  - Anchor Version: "0.29.0"
  - BPF Size: "2.1 KB"

**Contract Stats**:
- **Total Transactions**: "156"
- **Unique Callers**: "23"
- **Functions/Instructions**: "8"
- **Events**: "3"

**Contract Functions**:
- "increment() - 45 calls"
- "decrement() - 23 calls"
- "getValue() - 88 calls"
- "reset() - 5 calls"

**Read Contract**:
- "Value: 42"
- "Owner: 0x1111...2222"
- "Paused: false"

**Write Contract**:
- "increment" (call button)
- "decrement" (call button)
- "reset()" (restricted)

**Why this matters**: Contract views enable interaction and verification of deployed code.

## Cross-VM Operations

**Cross-VM Transaction Tracking**:
- **Atomic Operations**: Shows transactions that execute on both VMs
- **State Synchronization**: Displays cross-VM state changes
- **Asset Transfers**: Tracks asset movement between VMs

**Cross-VM Details**:
- **EVM Side**:
  - Contract Call: Counter.increment()
  - Gas Used: "45,000"
  - Events: "Increment(43)"
- **SVM Side**:
  - Program Call: "process_trade()"
  - Compute Units: "25,000"  
  - Logs: "Trade executed successfully"
- **Canonical Ledger**:
  - State Root: "0xabc123..."
  - Asset Balance: "Updated ✅"
  - Sync Status: "Complete"

**Why this matters**: Cross-VM operation tracking is unique to Atlas Sphere and requires clear presentation.

## Network Statistics

**Network Overview**:
- **Current Block**: "#45,672"
- **Block Time**: "6.0s average"
- **Transactions**: "1,234 in last 24h"
- **Network Utilization**: "67%"

**EVM Statistics**:
- **Gas Used**: "15M / 30M limit"
- **Avg Gas Price**: "10 Gwei"
- **EVM TPS**: "156"

**SVM Statistics**:
- **Compute Units**: "8M / 12M limit"
- **SVM TPS**: "2,340"
- **Parallel Execution**: "89% efficiency"

**Cross-VM Statistics**:
- **Atomic Operations**: "45 today"
- **Success Rate**: "99.8%"
- **Avg Latency**: "89ms"

**Why this matters**: Network statistics help users understand blockchain health and performance.

## Events and Logs

**Event Filtering**:
- "All Events"
- "Transfer Events"
- "Cross-VM Events"
- "Contract Events"

**Event Details**:
- **Event**: "Transfer(address,address,uint256)"
- **Block**: "#45,672"
- **Transaction**: "0xabcd...ef01"
- **From**: "0x1111...2222"
- **To**: "0x3333...4444"
- **Value**: "1,000 ATLAS"
- **Timestamp**: "2:11 PM UTC"

**Cross-VM Events**:
- **Event**: "CrossVmOperationExecuted"
- **EVM Status**: "Success"
- **SVM Status**: "Success"
- **Profit**: "50 ATLAS"
- **Gas Used**: "195,000"

**Why this matters**: Event tracking helps users monitor contract activity and cross-VM operations.

## Pagination

**Results Navigation**:
- "Showing 1-25 of 1,234 results"
- Previous/Next buttons
- Page numbers (1, 2, 3... 50)

**Load More**:
- "Load 25 more results"
- "Loading..." (spinner)

**Why this matters**: Proper pagination prevents performance issues with large result sets.

## Empty States

### No Search Results
**Title**: "No Results Found"  
**Description**: "No blocks, transactions, or addresses match your search"  
**Suggestions**: ["Try a different search term", "Check the spelling", "Search for a block number"]

### No Transactions
**Title**: "No Transactions"  
**Description**: "This block contains no transactions"  
**Context**: "Block #45,670 was empty"

### No Contract Code
**Title**: "Contract Not Verified"  
**Description**: "The contract source code is not available"  
**Actions**: ["Submit for verification", "View bytecode"]

**Why this matters**: Helpful empty states guide users toward alternative actions.

## Loading States

**Page Loading**:
- "Loading block information..."
- Skeleton cards for block details

**Transaction Loading**:
- "Loading transactions..."
- Skeleton list items

**Search Loading**:
- "Searching..."
- "Searching Atlas Sphere blockchain..."

**Why this matters**: Clear loading states prevent user confusion during data fetching.

## Error States

**Network Error**:
- "Unable to connect to explorer"
- "Please check your internet connection"
- Action: "Retry"

**Block Not Found**:
- "Block not found"
- "Block #123,456 does not exist"
- Action: "View Latest Block"

**Transaction Not Found**:
- "Transaction not found"
- "Hash 0xabcd...ef01 does not exist"
- Action: "Search Transactions"

**Why this matters**: Helpful error messages guide users toward resolution.

## Tooltips and Help

**Gas Information**:
- "Gas: Measure of computational work"
- "Learn more about gas"

**Cross-VM Info**:
- "Cross-VM: Atomic operation across EVM and SVM"
- "View cross-VM tutorial"

**Network Status**:
- "🟢 Network healthy"
- "All systems operational"

**Why this matters**: Contextual help improves user understanding of blockchain concepts.

---

*This microcopy ensures users can effectively navigate and understand blockchain data across both EVM and SVM environments.*
