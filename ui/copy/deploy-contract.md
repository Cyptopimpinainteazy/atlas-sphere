# Deploy Contract UI Copy

Microcopy and text content for the Atlas Sphere contract deployment interface.

## Page Header

**Main Title**: "Deploy Contract"  
*Context: Primary page heading*

**Subtitle**: "Deploy smart contracts to EVM, SVM, or both with atomic cross-VM execution"  
*Context: Brief description of deployment capabilities*

**VM Selection**:
- "Deploy to: EVM" / "SVM" / "Cross-VM" (radio buttons)
- Tooltip: "Cross-VM enables atomic execution across both VMs"

**Why this matters**: Clear deployment options help users choose the right execution environment for their needs.

## Contract Type Selection

**Contract Templates**:
- **Basic Contract**:
  - "Simple Counter"
  - "Token (ERC-20)"
  - "NFT Collection"
  - "Multi-signature Wallet"
- **Advanced Templates**:
  - "DeFi Protocol"
  - "Cross-VM Bridge"
  - "Atomic Arbitrage"
  - "Custom Template"

**Upload Options**:
- **Upload Source Code**:
  - "Solidity (.sol)"
  - "Vyper (.vy)"
  - "Rust (Anchor)"
- **Upload Bytecode**:
  - "EVM Bytecode"
  - "SVM BPF"
  - "Both (Cross-VM)"

**Why this matters**: Multiple deployment options accommodate different developer skill levels and use cases.

## Contract Configuration

### EVM Contract Settings

**Contract Details**:
- **Contract Name**: "MyContract" (input field)
- **Constructor Parameters**: 
  - Add parameter button
  - Parameter type dropdown
  - Value input field
- **Gas Configuration**:
  - Gas Limit: "1,000,000" (input)
  - Gas Price: "10" Gwei (slider)
  - Priority Fee: "2" Gwei (optional)

**EVM-Specific Options**:
- **Verification**: "Verify contract on explorer" (checkbox)
- **Optimization**: "Enable optimizer" (checkbox)
- **EVM Version**: "Paris" / "Berlin" / "London" (dropdown)

**Why this matters**: EVM deployment requires specific configuration for successful deployment.

### SVM Program Settings

**Program Details**:
- **Program Name**: "my_program" (input field)
- **Anchor Version**: "0.29.0" (auto-detected)
- **Program ID**: Generate/Use existing (toggle)

**Compute Configuration**:
- **Compute Units**: "200,000" (input)
- **Max Compute Units**: "300,000" (input)
- **Heap Size**: "32 MB" (dropdown)

**SVM-Specific Options**:
- **Verification**: "Verify program" (checkbox)
- **Upgrade Authority**: Set/None (input)
- **Program Size**: Display current size

**Why this matters**: SVM deployment requires compute unit configuration and program-specific settings.

### Cross-VM Configuration

**Cross-VM Bridge**:
- **Atomic Execution**: "Enable atomic commit" (checkbox)
- **State Synchronization**: "Sync canonical ledger" (checkbox)
- **Error Handling**: "Revert on VM failure" (checkbox)

**Deployment Coordination**:
- **Deploy Order**: "EVM First" / "SVM First" / "Parallel"
- **Timeout**: "5 minutes" (dropdown)
- **Retry Logic**: "Retry failed deployments" (checkbox)

**Why this matters**: Cross-VM deployment requires coordination and atomic execution guarantees.

## Code Editor

**Editor Features**:
- **Language Support**: Solidity, Vyper, Rust
- **Syntax Highlighting**: Automatic
- **Auto-completion**: Enabled
- **Error Detection**: Real-time

**Code Templates**:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyContract {
    uint256 public value;
    
    constructor(uint256 _value) {
        value = _value;
    }
    
    function setValue(uint256 _value) external {
        value = _value;
    }
}
```

**Compilation Status**:
- "✅ Compiled successfully"
- "❌ Compilation failed: 3 errors"
- "⚠️ 2 warnings found"

**Why this matters**: In-browser editing enables quick contract development without external tools.

## Compilation & Validation

**Compilation Process**:
- **Step 1**: "Analyzing source code..."
- **Step 2**: "Compiling to bytecode..."
- **Step 3**: "Optimizing gas usage..."
- **Step 4**: "Generating ABI..."

**Validation Checks**:
- **Syntax Validation**: ✅ Passed
- **Security Analysis**: ✅ Passed
- **Gas Estimation**: "~150,000 gas"
- **Size Check**: "2.3 KB (within limit)"

**Warnings**:
- "Unchecked external call"
- "Potential reentrancy vulnerability"
- "Unused state variable"

**Why this matters**: Pre-deployment validation prevents failed deployments and security issues.

## Deployment Process

### EVM Deployment

**Deployment Steps**:
1. **Estimate Gas**: "Gas estimation: 245,000"
2. **Create Transaction**: "Building deployment transaction..."
3. **Sign Transaction**: "Please sign in your wallet"
4. **Broadcast**: "Submitting to network..."
5. **Wait for Confirmation**: "Transaction pending... (1/12 confirmations)"

**Deployment Status**:
- "🚀 Deploying contract..."
- "⏳ Waiting for confirmation..."
- "✅ Contract deployed successfully!"
- "🔗 Contract Address: 0x1234...5678"

**Why this matters**: Clear deployment status helps users understand the process and troubleshoot issues.

### SVM Deployment

**Deployment Steps**:
1. **Build Program**: "Compiling BPF bytecode..."
2. **Load Accounts**: "Initializing program accounts..."
3. **Deploy to Cluster**: "Uploading program..."
4. **Verify Deployment**: "Testing program functionality..."

**Deployment Status**:
- "🚀 Building SVM program..."
- "📤 Uploading to network..."
- "✅ Program deployed successfully!"
- "🔗 Program ID: 0x9876...5432"

**Why this matters**: SVM deployment has different steps and requires different status updates.

### Cross-VM Deployment

**Atomic Deployment**:
1. **Prepare EVM**: "Compiling EVM contract..."
2. **Prepare SVM**: "Building SVM program..."
3. **Deploy Both**: "Executing atomic deployment..."
4. **Verify Sync**: "Synchronizing canonical ledger..."
5. **Complete**: "Cross-VM deployment successful!"

**Cross-VM Status**:
- "🚀 EVM Contract: 0xabcd...1234 ✅"
- "🚀 SVM Program: 0x5678...abcd ✅"
- "🔗 Cross-VM Bridge: Active ✅"
- "📊 Atomic Execution: Verified ✅"

**Why this matters**: Cross-VM deployment requires coordination and verification across both VMs.

## Post-Deployment

**Contract Interaction**:
- **Read Functions**: "getValue() → 42"
- **Write Functions**: "setValue(100)" (call button)
- **Events**: "ValueChanged(100)" (event log)

**Verification**:
- **Auto-verify**: "Source code verified ✅"
- **Explorer Link**: "View on Explorer"
- **ABI Export**: "Download ABI JSON"

**Management**:
- **Upgrade**: "Can be upgraded"
- **Ownership**: "Owner: 0x1111...2222"
- **Pause**: "Emergency pause available"

**Why this matters**: Post-deployment tools help users interact with and manage their contracts.

## Error Handling

### Compilation Errors

**Syntax Errors**:
- "❌ Error: Missing semicolon at line 15"
- "❌ Error: Undeclared identifier 'myVariable'"
- "❌ Error: Type mismatch: expected uint256, found string"

**Security Warnings**:
- "⚠️ Warning: Unprotected external function"
- "⚠️ Warning: Integer overflow possible"
- "⚠️ Warning: Reentrancy risk detected"

**Why this matters**: Clear error messages help developers fix issues quickly.

### Deployment Errors

**EVM Errors**:
- "❌ Deployment failed: Out of gas"
- "❌ Deployment failed: Contract creation code cost more than gas limit"
- "❌ Deployment failed:insufficient funds for gas * price + value"

**SVM Errors**:
- "❌ Deployment failed: Account not funded"
- "❌ Deployment failed: Compute unit limit exceeded"
- "❌ Deployment failed: Invalid program data"

**Cross-VM Errors**:
- "❌ Cross-VM deployment failed: EVM timeout"
- "❌ Atomic commit failed: State synchronization error"
- "❌ Bridge connection failed: Network unreachable"

**Why this matters**: Specific error messages help users understand and resolve deployment issues.

## Gas & Cost Estimation

**EVM Costs**:
- **Deployment Cost**: "0.025 ATLAS ($2.50)"
- **Gas Estimate**: "250,000 gas"
- **Gas Price**: "10 Gwei"
- **Network Congestion**: "Low" (estimated)

**SVM Costs**:
- **Deployment Cost**: "0.001 ATLAS ($0.10)"
- **Compute Units**: "150,000 CU"
- **Account Creation**: "3 accounts × 0.00001 ATLAS"
- **Program Size**: "2.1 KB"

**Cross-VM Costs**:
- **Total Cost**: "0.026 ATLAS ($2.60)"
- **EVM Share**: "96% of total cost"
- **SVM Share**: "4% of total cost"
- **Bridge Fee**: "0.0001 ATLAS"

**Why this matters**: Cost estimation helps users budget for deployments and understand fee distribution.

## Templates & Examples

### Starter Templates

**Beginner Templates**:
- **Hello World**: Simple counter contract
- **Basic Token**: ERC-20 token with mint/burn
- **Simple NFT**: ERC-721 collection
- **Multi-Sig**: 2-of-3 multi-signature wallet

**Intermediate Templates**:
- **AMM**: Automated Market Maker
- **Lending**: Simple lending protocol
- **Cross-VM Bridge**: Basic bridge contract
- **Oracle**: Price feed integration

**Advanced Templates**:
- **DeFi Protocol**: Complete DeFi application
- **Cross-VM Arbitrage**: Atomic arbitrage system
- **Gaming**: On-chain game mechanics
- **DAO**: Decentralized governance

**Why this matters**: Templates accelerate development by providing proven starting points.

### Example Contracts

**EVM Examples**:
```solidity
// Simple Counter
contract Counter {
    uint256 public count;
    event Incremented(uint256 newCount);
    
    function increment() external {
        count++;
        emit Incremented(count);
    }
}
```

**SVM Examples**:
```rust
// Simple Counter Program
#[program]
pub mod counter {
    use super::*;
    
    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count += 1;
        Ok(())
    }
}
```

**Why this matters**: Working examples help developers understand contract structure and patterns.

## Help & Documentation

**Getting Started**:
- "📚 Contract Deployment Guide"
- "🎥 Video Tutorial (5 min)"
- "💡 Best Practices"
- "🛠️ Developer Tools"

**VM-Specific Help**:
- "EVM Deployment Guide"
- "SVM (Anchor) Tutorial"
- "Cross-VM Coordination"
- "Gas Optimization Tips"

**Troubleshooting**:
- "Common Deployment Errors"
- "Network Status Check"
- "Wallet Connection Issues"
- "Contact Support"

**Why this matters**: Accessible help resources reduce support burden and improve developer experience.

## Settings & Configuration

**Compiler Settings**:
- **Solidity Version**: "0.8.19" (dropdown)
- **Optimization**: "200 runs" (slider)
- **EVM Version**: "Paris" (dropdown)

**Network Settings**:
- **RPC Endpoint**: "Auto-detect" / "Custom" (input)
- **Timeout**: "5 minutes" (dropdown)
- **Confirmation Blocks**: "12" (input)

**Wallet Settings**:
- **Account Selection**: "Auto-select funded account"
- **Gas Estimation**: "Manual" / "Automatic"
- **Transaction Priority**: "Normal" / "Fast" / "Instant"

**Why this matters**: Customizable settings accommodate different developer preferences and requirements.

---

*This microcopy ensures smooth contract deployment experience across all VM types while highlighting Atlas Sphere's unique cross-VM capabilities.*
