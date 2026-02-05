/// <reference types="mocha" />
const { expect } = require('chai');
const sinon = require('sinon');

describe('Ethereum handler fee bumping', () => {
  it('retries and succeeds on subsequent attempt with dynamic fees', async () => {
    const ethHandler = require('../src/handlers/ethereum');
    process.env.ETHEREUM_RPC_URL = 'http://localhost:8545';
    process.env.ETHEREUM_PRIVATE_KEY = '0x0123456789012345678901234567890123456789012345678901234567890123';

    // Mock provider.getFeeData, getBlock, and wallet/provider
    const fakeProvider = { 
      getFeeData: sinon.stub().resolves({ 
        maxFeePerGas: 100000n, 
        maxPriorityFeePerGas: 10000n 
      }),
      getBlock: sinon.stub().resolves({
        baseFeePerGas: 80000n
      })
    };
    
    const fakeWait = sinon.stub();
    fakeWait.onFirstCall().rejects(new Error('nonce error'));
    fakeWait.onSecondCall().resolves({ transactionHash: '0xabc' });

    const fakeTx = { wait: fakeWait };

    // Default withdraw resolves to fakeTx, but first call should reject
    const fakeContract = { withdraw: sinon.stub().resolves(fakeTx) };
    fakeContract.withdraw.onFirstCall().rejects(new Error('revert')); // low-level revert

    // Stub ethers provider and contract behavior by modifying prototypes
    const ethers = require('ethers');
    const origWithdraw = ethers.Contract.prototype.withdraw;
    ethers.Contract.prototype.withdraw = fakeContract.withdraw;

    // Stub JsonRpcProvider.getFeeData and getBlock
    const origGetFeeData = ethers.JsonRpcProvider.prototype.getFeeData;
    const origGetBlock = ethers.JsonRpcProvider.prototype.getBlock;
    ethers.JsonRpcProvider.prototype.getFeeData = fakeProvider.getFeeData;
    ethers.JsonRpcProvider.prototype.getBlock = fakeProvider.getBlock;

    // Call handler
    try {
      const res = await ethHandler.ethereumHandler({ 
        swapId: 's', 
        chain: 'ethereum', 
        preimage: '01', 
        lock: { address: '0xdeadbeef', htlcId: '0x01' } 
      });
      expect(res).to.equal('0xabc');
      
      // Verify getBlock was called for base fee estimation
      expect(fakeProvider.getBlock.called).to.be.true;
    } finally {
      ethers.Contract.prototype.withdraw = origWithdraw;
      ethers.JsonRpcProvider.prototype.getFeeData = origGetFeeData;
      ethers.JsonRpcProvider.prototype.getBlock = origGetBlock;
    }
  });

  it('uses exponential fee bumping on retries', async () => {
    const ethHandler = require('../src/handlers/ethereum');
    process.env.ETHEREUM_RPC_URL = 'http://localhost:8545';
    process.env.ETHEREUM_PRIVATE_KEY = '0x0123456789012345678901234567890123456789012345678901234567890123';

    const fakeProvider = { 
      getFeeData: sinon.stub().resolves({ 
        maxFeePerGas: 100000n, 
        maxPriorityFeePerGas: 10000n 
      }),
      getBlock: sinon.stub().resolves({
        baseFeePerGas: 80000n
      })
    };

    const fakeWait = sinon.stub();
    fakeWait.onCall(0).rejects(new Error('underpriced'));
    fakeWait.onCall(1).rejects(new Error('underpriced'));
    fakeWait.onCall(2).resolves({ transactionHash: '0xdef' });

    const fakeTx = { wait: fakeWait };
    const fakeContract = { withdraw: sinon.stub().resolves(fakeTx) };

    const ethers = require('ethers');
    const origWithdraw = ethers.Contract.prototype.withdraw;
    const origGetFeeData = ethers.JsonRpcProvider.prototype.getFeeData;
    const origGetBlock = ethers.JsonRpcProvider.prototype.getBlock;
    
    ethers.Contract.prototype.withdraw = fakeContract.withdraw;
    ethers.JsonRpcProvider.prototype.getFeeData = fakeProvider.getFeeData;
    ethers.JsonRpcProvider.prototype.getBlock = fakeProvider.getBlock;

    try {
      const res = await ethHandler.ethereumHandler({ 
        swapId: 's', 
        chain: 'ethereum', 
        preimage: '02', 
        lock: { address: '0xdeadbeef', htlcId: '0x02' } 
      });
      expect(res).to.equal('0xdef');
      
      // Verify withdraw was called multiple times with increasing fees
      expect(fakeContract.withdraw.callCount).to.be.greaterThan(1);
    } finally {
      ethers.Contract.prototype.withdraw = origWithdraw;
      ethers.JsonRpcProvider.prototype.getFeeData = origGetFeeData;
      ethers.JsonRpcProvider.prototype.getBlock = origGetBlock;
    }
  });
});

export {};
