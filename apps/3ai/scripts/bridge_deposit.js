/**
 * Bridge Deposit Script for 3ai Chain
 * Deposits ETH or ERC20 tokens from L1 (Ethereum) to L2 (your OP Stack chain)
 */

const ethers = require('ethers');
const { getContractFactory, getSigners } = require('hardhat');

// Replace with your deployed addresses
const L1_STANDARD_BRIDGE = '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1'; // OP Stack L1 Bridge
const L2_STANDARD_BRIDGE = '0x4200000000000000000000000000000000000010'; // OP Stack L2 Bridge

// L1 Contract addresses
const L1_ERC20_ADDRESS = process.env.L1_TOKEN_ADDRESS || ethers.constants.AddressZero; // ETH or ERC20
const L2_ERC20_ADDRESS = process.env.L2_TOKEN_ADDRESS || ethers.constants.AddressZero;

// Amount to deposit (in wei for ETH, or token units)
const DEPOSIT_AMOUNT = ethers.utils.parseEther('1'); // 1 ETH/token

async function main() {
    console.log('Starting bridge deposit...');

    // Connect to providers
    const l1Provider = new ethers.providers.JsonRpcProvider(process.env.L1_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY');
    const l2Provider = new ethers.providers.JsonRpcProvider(process.env.L2_RPC_URL || 'http://localhost:8545');

    // Get signer
    const deployer = new ethers.Wallet(process.env.PRIVATE_KEY, l1Provider);

    console.log(`Depositing from: ${deployer.address}`);
    console.log(`Amount: ${ethers.utils.formatEther(DEPOSIT_AMOUNT)}`);

    // For ETH deposits
    if (L1_ERC20_ADDRESS === ethers.constants.AddressZero) {
        console.log('Depositing ETH...');

        // Get L1 Standard Bridge contract
        const l1BridgeAbi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "_to", "type": "address"},
                    {"internalType": "uint256", "name": "_amount", "type": "uint256"},
                    {"internalType": "uint32", "name": "_minGasLimit", "type": "uint32"},
                    {"internalType": "bytes", "name": "_extraData", "type": "bytes"}
                ],
                "name": "depositETH",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            }
        ];

        const l1Bridge = new ethers.Contract(L1_STANDARD_BRIDGE, l1BridgeAbi, deployer);

        // Deposit ETH
        const tx = await l1Bridge.depositETH(
            deployer.address, // _to
            DEPOSIT_AMOUNT,   // _amount
            200000,           // _minGasLimit
            '0x',             // _extraData
            {
                value: DEPOSIT_AMOUNT,
                gasLimit: 200000
            }
        );

        console.log(`Deposit TX: ${tx.hash}`);
        await tx.wait();
        console.log('ETH deposit successful!');

    } else {
        // For ERC20 deposits
        console.log('Depositing ERC20...');

        const erc20Abi = [
            {
                "constant": false,
                "inputs": [
                    {"name": "_spender", "type": "address"},
                    {"name": "_value", "type": "uint256"}
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            }
        ];

        const token = new ethers.Contract(L1_ERC20_ADDRESS, erc20Abi, deployer);

        // Approve bridge
        console.log('Approving bridge...');
        const approveTx = await token.approve(L1_STANDARD_BRIDGE, DEPOSIT_AMOUNT);
        await approveTx.wait();

        // Bridge deposit
        const l1BridgeAbi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "_l1Token", "type": "address"},
                    {"internalType": "address", "name": "_l2Token", "type": "address"},
                    {"internalType": "uint256", "name": "_amount", "type": "uint256"},
                    {"internalType": "uint32", "name": "_minGasLimit", "type": "uint32"},
                    {"internalType": "bytes", "name": "_extraData", "type": "bytes"}
                ],
                "name": "depositERC20",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ];

        const l1Bridge = new ethers.Contract(L1_STANDARD_BRIDGE, l1BridgeAbi, deployer);

        const tx = await l1Bridge.depositERC20(
            L1_ERC20_ADDRESS, // _l1Token
            L2_ERC20_ADDRESS, // _l2Token
            DEPOSIT_AMOUNT,    // _amount
            200000,            // _minGasLimit
            '0x'               // _extraData
        );

        console.log(`Deposit TX: ${tx.hash}`);
        await tx.wait();
        console.log('ERC20 deposit successful!');
    }

    // Wait for cross-chain message to be relayed (usually takes ~1-5 minutes)
    console.log('Waiting for cross-chain message relay...');
    console.log('You can check L2 balance after the message is relayed.');

    // Optional: Check L2 balance
    const l2Signer = new ethers.Wallet(process.env.PRIVATE_KEY, l2Provider);
    if (L1_ERC20_ADDRESS === ethers.constants.AddressZero) {
        const balance = await l2Provider.getBalance(deployer.address);
        console.log(`L2 ETH Balance: ${ethers.utils.formatEther(balance)}`);
    } else {
        const erc20Abi = [{"constant": true, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "stateMutability": "view", "type": "function"}];
        const l2Token = new ethers.Contract(L2_ERC20_ADDRESS, erc20Abi, l2Signer);
        const balance = await l2Token.balanceOf(deployer.address);
        console.log(`L2 Token Balance: ${balance.toString()}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
