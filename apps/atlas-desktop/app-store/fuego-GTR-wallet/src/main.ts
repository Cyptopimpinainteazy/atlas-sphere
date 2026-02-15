import { invoke } from "@tauri-apps/api/core";

// Wallet state
let walletInfo: any = null;
let transactions: any[] = [];
let networkStatus: any = null;
let deposits: any[] = [];
let availableFonts: string[] = [];

// DOM elements
let walletStatusEl: HTMLElement | null;
let balanceEl: HTMLElement | null;
let addressEl: HTMLElement | null;
let transactionsEl: HTMLElement | null;
let networkStatusEl: HTMLElement | null;

// Initialize the application
async function init() {
  console.log("🔥 Initializing Fuego Desktop Wallet...");
  
  // Load fonts from assets folder
  loadAvailableFonts();
  
  // Show welcome modal until a wallet is opened/created/imported
  showWelcomeModal();
}

// Load wallet information
async function loadWalletInfo() {
  try {
    walletInfo = await invoke("wallet_get_info");
    console.log("✅ Wallet info loaded:", walletInfo);
    showStatusUpdate("Wallet Connected", "success");
    postWalletOpenBoot();
  } catch (error) {
    console.error("❌ Failed to load wallet info:", error);
    // Do not auto-create; leave welcome modal visible
  }
}

// Create a default wallet if none exists
// ===== Welcome Modal Flow =====
function showWelcomeModal() {
  const modal = document.querySelector('#welcome-modal') as HTMLElement;
  if (!modal) return;
  modal.style.display = 'flex';

  const setPanel = (id: string) => {
    document.querySelectorAll('#welcome-modal .panel').forEach(p => (p as HTMLElement).style.display = 'none');
    if (id) {
      const panel = document.querySelector(id) as HTMLElement;
      if (panel) panel.style.display = 'block';
    }
  };

  // Actions
  document.querySelector('#action-create')?.addEventListener('click', () => setPanel('#panel-create'));
  document.querySelector('#action-open')?.addEventListener('click', () => setPanel('#panel-open'));
  document.querySelector('#action-import-seed')?.addEventListener('click', () => setPanel('#panel-import-seed'));
  document.querySelector('#action-import-keys')?.addEventListener('click', () => setPanel('#panel-import-keys'));

  // Confirm handlers
  document.querySelector('#open-confirm')?.addEventListener('click', async () => {
    const path = (document.querySelector('#open-path') as HTMLInputElement)?.value?.trim();
    const password = (document.querySelector('#open-password') as HTMLInputElement)?.value ?? '';
    if (!path) { alert('Please enter wallet file path'); return; }
    try {
      await invoke('wallet_open', { filePath: path, password });
      await afterWalletOpened(modal);
    } catch (e) { alert(`Open failed: ${e}`); }
  });

  document.querySelector('#create-confirm')?.addEventListener('click', async () => {
    const path = (document.querySelector('#create-path') as HTMLInputElement)?.value?.trim();
    const password = (document.querySelector('#create-password') as HTMLInputElement)?.value ?? '';
    if (!path || !password) { alert('Enter path and password'); return; }
    try {
      await invoke('wallet_create', { password, filePath: path, seedPhrase: null, restoreHeight: 0 });
      await invoke('wallet_open', { filePath: path, password });
      await afterWalletOpened(modal);
    } catch (e) { alert(`Create failed: ${e}`); }
  });

  document.querySelector('#import-seed-confirm')?.addEventListener('click', async () => {
    const seed = (document.querySelector('#import-seed-text') as HTMLTextAreaElement)?.value?.trim();
    const rh = parseInt((document.querySelector('#import-seed-restore-height') as HTMLInputElement)?.value || '0', 10) || 0;
    const path = (document.querySelector('#import-seed-path') as HTMLInputElement)?.value?.trim();
    const password = (document.querySelector('#import-seed-password') as HTMLInputElement)?.value ?? '';
    if (!seed || !path) { alert('Enter seed and wallet file path'); return; }
    try {
      await invoke('wallet_create', { password, filePath: path, seedPhrase: seed, restoreHeight: rh });
      await invoke('wallet_open', { filePath: path, password });
      await afterWalletOpened(modal);
    } catch (e) { alert(`Import by mnemonic failed: ${e}`); }
  });

  document.querySelector('#import-keys-confirm')?.addEventListener('click', async () => {
    const viewKey = (document.querySelector('#import-view-key') as HTMLInputElement)?.value?.trim();
    const spendKey = (document.querySelector('#import-spend-key') as HTMLInputElement)?.value?.trim();
    const address = (document.querySelector('#import-address') as HTMLInputElement)?.value?.trim();
    const path = (document.querySelector('#import-keys-path') as HTMLInputElement)?.value?.trim();
    const password = (document.querySelector('#import-keys-password') as HTMLInputElement)?.value ?? '';
    if (!viewKey || !spendKey || !address || !path) { alert('Enter keys, address, and path'); return; }
    try {
      // Create empty then import keys
      await invoke('wallet_create', { password, filePath: path, seedPhrase: null, restoreHeight: 0 });
      await invoke('wallet_open', { filePath: path, password });
      await invoke('import_keys', { viewKey, spendKey, address });
      await afterWalletOpened(modal);
    } catch (e) { alert(`Import by keys failed: ${e}`); }
  });
}

async function afterWalletOpened(modal: HTMLElement) {
  modal.style.display = 'none';
  await postWalletOpenBoot();
}

async function postWalletOpenBoot() {
  // Connect to node (remote default) and start loading data
  try {
    await invoke('node_connect', { address: 'fuego.spaceportx.net', port: 18180 });
  } catch (e) { console.warn('node_connect failed:', e); }
  await loadWalletInfo();
  await loadTransactions();
  await loadNetworkStatus();
  await loadSyncProgress();
  await loadDeposits();
  updateUI();
  startRealTimeUpdates();
}

// Load transactions
async function loadTransactions() {
  try {
    transactions = await invoke("get_transaction_history", { limit: 10, offset: 0 });
    console.log("Transactions loaded:", transactions);
  } catch (error) {
    console.error("Failed to load transactions:", error);
  }
}

// Load network status
async function loadNetworkStatus() {
  try {
    networkStatus = await invoke("network_get_status");
    console.log("Network status loaded:", networkStatus);
  } catch (error) {
    console.error("Failed to load network status:", error);
  }
}

// Load sync progress
async function loadSyncProgress() {
  try {
    const syncProgress = await invoke("get_sync_progress");
    console.log("Sync progress loaded:", syncProgress);
    updateSyncDisplay(syncProgress);
  } catch (error) {
    console.error("Failed to load sync progress:", error);
  }
}



// Start real-time updates
function startRealTimeUpdates() {
  // Update sync progress every 2 seconds
  setInterval(async () => {
    await loadSyncProgress();
    await loadNetworkStatus();
  }, 2000);
  
  // Update wallet info every 10 seconds
  setInterval(async () => {
    await loadWalletInfo();
  }, 10000);
  
  // Update transactions every 30 seconds
  setInterval(async () => {
    await loadTransactions();
  }, 30000);
}

// Real-time wallet refresh
async function refreshWallet() {
  try {
    await invoke("wallet_refresh");
    await loadWalletInfo();
    await loadTransactions();
    console.log("✅ Wallet refreshed");
  } catch (error) {
    console.error("❌ Failed to refresh wallet:", error);
  }
}

// ===== Term Deposits (on-chain locking) =====
async function loadDeposits() {
  try {
    deposits = await invoke('deposit_list');
    console.log('Deposits loaded:', deposits);
    updateDepositsDisplay();
  } catch (error) {
    console.error('Failed to load deposits:', error);
  }
}

async function createDeposit() {
  const amountInput = document.querySelector('#deposit-amount') as HTMLInputElement;
  const termSelect = document.querySelector('#deposit-term') as HTMLSelectElement;
  if (!amountInput || !termSelect) return;
  
  const amount = parseFloat(amountInput.value);
  const term = parseInt(termSelect.value, 10);
  
  if (isNaN(amount) || amount < 1) {
    alert('Minimum deposit amount is 1 XFG');
    return;
  }
  if (isNaN(term)) {
    alert('Please select a valid term');
    return;
  }
  
  try {
    const amountAtomic = Math.floor(amount * 10000000);
    const depositId = await invoke('deposit_create', { amount: amountAtomic, term });
    alert(`Deposit created successfully. ID: ${depositId}`);
    amountInput.value = '';
    await loadDeposits();
    await refresh();
  } catch (error) {
    console.error('Failed to create deposit:', error);
    alert(`Failed to create deposit: ${error}`);
  }
}

async function withdrawDeposit(depositId: string) {
  if (!depositId) return;
  try {
    const txHash = await invoke('deposit_withdraw', { depositId });
    alert(`Withdrawn successfully. TX: ${txHash}`);
    await loadDeposits();
    await refresh();
  } catch (error) {
    console.error('Failed to withdraw deposit:', error);
    alert(`Failed to withdraw deposit: ${error}`);
  }
}

function updateDepositsDisplay() {
  const listEl = document.querySelector('#deposits-list');
  if (!listEl) return;
  
  if (!Array.isArray(deposits) || deposits.length === 0) {
    listEl.innerHTML = '<div class="no-data">No term deposits found</div>';
    return;
  }
  
  listEl.innerHTML = deposits.map((d: any) => {
    const amountXFG = (d.amount / 10000000).toFixed(7);
    const interestXFG = (d.interest / 10000000).toFixed(7);
    const canWithdraw = d.status === 'unlocked';
    return `
      <div class="deposit-item">
        <div class="deposit-row">
          <div class="deposit-col">
            <div><strong>Amount:</strong> ${amountXFG} XFG</div>
            <div><strong>Interest:</strong> ${interestXFG} XFG</div>
          </div>
          <div class="deposit-col">
            <div><strong>Term:</strong> ${d.term} days</div>
            <div><strong>Rate:</strong> ${(d.rate * 100).toFixed(2)}%</div>
          </div>
          <div class="deposit-col">
            <div><strong>Status:</strong> ${d.status}</div>
            <div><strong>Unlock Height:</strong> ${d.unlock_height}</div>
          </div>
          <div class="deposit-actions">
            <button class="btn btn-secondary view-tx" data-hash="${d.creating_transaction_hash}">View TX</button>
            <button class="btn btn-primary withdraw-deposit-btn" data-id="${d.id}" ${canWithdraw ? '' : 'disabled'}>Withdraw</button>
          </div>
        </div>
      </div>`;
  }).join('');
  
  // Bind withdraw buttons
  document.querySelectorAll('.withdraw-deposit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).getAttribute('data-id') || '';
      withdrawDeposit(id);
    });
  });
}

// Update UI with loaded data
function updateUI() {
  // Update wallet status
  if (walletStatusEl) {
    walletStatusEl.textContent = walletInfo ? "Wallet Connected" : "Wallet Disconnected";
    walletStatusEl.className = walletInfo ? "status connected" : "status disconnected";
  }
  
  // Update balance
  if (balanceEl && walletInfo) {
    // XFG uses 7 decimal places (10000000 atomic units = 1 XFG)
    const balance = (walletInfo.balance / 10000000).toFixed(7);
    balanceEl.textContent = `${balance} XFG`;
  }
  
  // Update address
  if (addressEl && walletInfo) {
    addressEl.textContent = walletInfo.address || "No address";
  }
  
  // Update transactions
  if (transactionsEl) {
    transactionsEl.innerHTML = transactions.map(tx => `
      <div class="transaction">
        <div class="tx-info">
          <span class="tx-amount ${tx.amount > 0 ? 'positive' : 'negative'}">
            ${tx.amount > 0 ? '+' : ''}${(tx.amount / 10000000).toFixed(7)} XFG
          </span>
          <span class="tx-address">${tx.address}</span>
        </div>
        <div class="tx-details">
          <span class="tx-time">${new Date(tx.timestamp * 1000).toLocaleString()}</span>
          <span class="tx-status ${tx.is_confirmed ? 'confirmed' : 'pending'}">
            ${tx.is_confirmed ? 'Confirmed' : 'Pending'}
          </span>
        </div>
      </div>
    `).join('');
  }
  
  // Update network status
  if (networkStatusEl && networkStatus) {
    networkStatusEl.innerHTML = `
      <div class="network-info">
        <span class="status ${networkStatus.is_connected ? 'connected' : 'disconnected'}">
          ${networkStatus.is_connected ? 'Connected' : 'Disconnected'}
        </span>
        <span class="sync-info">
          ${networkStatus.is_syncing ? 'Syncing' : 'Synced'} 
          (${networkStatus.sync_height}/${networkStatus.network_height})
        </span>
        <span class="peer-count">${networkStatus.peer_count} peers</span>
      </div>
    `;
  }
  
  // Update sync progress display
  updateSyncDisplay(networkStatus);
  
  // Update last refresh time
  const lastUpdateEl = document.querySelector("#last-update");
  if (lastUpdateEl) {
    lastUpdateEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  }
}

// Refresh data
async function refresh() {
  await refreshWallet();
  await loadNetworkStatus();
  await loadSyncProgress();
  updateUI();
  await loadDeposits();
}

// Show real-time status updates
function showStatusUpdate(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  console.log(`${type.toUpperCase()}: ${message}`);
  
  // You could add toast notifications here if needed
  const statusEl = document.querySelector('#wallet-status');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${type === 'success' ? 'connected' : 'disconnected'}`;
  }
}

// ===== Fonts =====
function loadAvailableFonts() {
  // Use actual project fonts from src/assets/fonts
  availableFonts = [
    'Orbitron',
    'BelligoesRegular',
    'HoloJacket',
  ];
  const select = document.querySelector('#font-select') as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = availableFonts.map(f => `<option value="${f}">${f}</option>`).join('');
  // Set default to Orbitron
  select.value = 'Orbitron';
  applyFont('Orbitron');
  select.addEventListener('change', () => {
    applyFont(select.value);
  });
}

function applyFont(fontName: string) {
  document.documentElement.style.setProperty('--app-font-family', `'${fontName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`);
}

// Test functions removed (no longer used)

// Send transaction function
async function sendTransaction() {
  const recipientAddress = (document.querySelector("#recipient-address") as HTMLInputElement)?.value;
  const amountInput = (document.querySelector("#amount") as HTMLInputElement)?.value;
  const paymentId = (document.querySelector("#payment-id") as HTMLInputElement)?.value;

  if (!recipientAddress || !amountInput) {
    alert("Please fill in recipient address and amount");
    return;
  }

  const amount = parseFloat(amountInput);
  if (amount <= 0) {
    alert("Amount must be greater than 0");
    return;
  }

  try {
    // Convert XFG to atomic units (7 decimal places)
    const amountAtomicUnits = Math.floor(amount * 10000000);
    
    const result = await invoke("wallet_send_transaction", {
      recipient: recipientAddress,
      amount: amountAtomicUnits,
      paymentId: paymentId || null,
      mixin: 5
    });
    
    console.log("Transaction sent:", result);
    alert(`Transaction sent successfully!\nHash: ${result}`);
    
    // Clear form
    (document.querySelector("#recipient-address") as HTMLInputElement).value = "";
    (document.querySelector("#amount") as HTMLInputElement).value = "";
    (document.querySelector("#payment-id") as HTMLInputElement).value = "";
    
    // Refresh wallet info
    await refresh();
  } catch (error) {
    console.error("Failed to send transaction:", error);
    alert(`Failed to send transaction: ${error}`);
  }
}

// Update sync progress display (consolidated)
function updateSyncDisplay(syncProgress: any) {
  const syncProgressTextEl = document.querySelector("#sync-progress-text");
  const syncDetailsEl = document.querySelector("#sync-details");
  const syncFillEl = document.querySelector(".sync-fill");
  const lastUpdateEl = document.querySelector("#last-update");

  if (syncProgressTextEl && syncDetailsEl) {
    if (syncProgress && syncProgress.is_syncing) {
      const progress = syncProgress.progress_percentage ? syncProgress.progress_percentage.toFixed(1) : '0.0';
      const currentHeight = syncProgress.current_height ? syncProgress.current_height.toLocaleString() : '0';
      const totalHeight = syncProgress.total_height ? syncProgress.total_height.toLocaleString() : '0';
      
      syncProgressTextEl.textContent = `🔄 Syncing... ${progress}%`;
      syncDetailsEl.textContent = `Block ${currentHeight} of ${totalHeight}`;

      // Update progress bar
      if (syncFillEl) {
        (syncFillEl as HTMLElement).style.width = `${syncProgress.progress_percentage || 0}%`;
      }
    } else if (syncProgress && !syncProgress.is_syncing) {
      syncProgressTextEl.textContent = "✅ Fully Synced";
      syncDetailsEl.textContent = `Connected to network`;

      // Fill progress bar
      if (syncFillEl) {
        (syncFillEl as HTMLElement).style.width = "100%";
      }
    } else {
      syncProgressTextEl.textContent = "⚠️ Disconnected";
      syncDetailsEl.textContent = `No network connection`;
      
      if (syncFillEl) {
        (syncFillEl as HTMLElement).style.width = "0%";
      }
    }

    // Update last update time
    if (lastUpdateEl) {
      lastUpdateEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }
  }
}

// Mining state
let currentMiningTab = 'solo';
let miningStatsInterval: number | null = null;

// Mining functions
async function startMining() {
  const threadsInput = document.querySelector("#mining-threads") as HTMLInputElement;
  const threads = parseInt(threadsInput?.value || "4", 10);

  if (threads < 1 || threads > 32) {
    alert("Thread count must be between 1 and 32");
    return;
  }

  try {
    let success = false;
    
    switch (currentMiningTab) {
      case 'solo':
        // Start solo mining with local daemon
        const daemonAddress = (document.querySelector("#daemon-address") as HTMLInputElement)?.value || "127.0.0.1:20060";
        success = await invoke("wallet_start_mining", { 
          threads, 
          background: true,
          daemonAddress 
        });
        break;
        
      case 'pool':
        // Start pool mining
        const poolUrl = (document.querySelector("#pool-url") as HTMLInputElement)?.value || "loudmining.com";
        const poolPort = (document.querySelector("#pool-port") as HTMLInputElement)?.value || "4444";
        const walletAddress = (document.querySelector("#wallet-address") as HTMLInputElement)?.value;
        const password = (document.querySelector("#pool-password") as HTMLInputElement)?.value || "x";
        const rigId = (document.querySelector("#rig-id") as HTMLInputElement)?.value || "fuego-gtr";
        
        if (!walletAddress) {
          alert("Please enter your wallet address for pool mining");
          return;
        }
        
        await invoke("wallet_set_mining_pool", {
          poolAddress: `${poolUrl}:${poolPort}`,
          workerName: rigId
        });
        
        success = await invoke("wallet_start_mining", { 
          threads, 
          background: true,
          poolWallet: walletAddress,
          poolPassword: password
        });
        break;
        
      case 'solo-pool':
        // Start solo mining through pool
        const soloWalletAddress = (document.querySelector("#solo-wallet-address") as HTMLInputElement)?.value;
        const soloRigId = (document.querySelector("#solo-rig-id") as HTMLInputElement)?.value || "fuego-gtr-solo";
        
        if (!soloWalletAddress) {
          alert("Please enter your wallet address for solo pool mining");
          return;
        }
        
        await invoke("wallet_set_mining_pool", {
          poolAddress: "solo.loudmining.com:7777",
          workerName: soloRigId
        });
        
        success = await invoke("wallet_start_mining", { 
          threads, 
          background: true,
          poolWallet: soloWalletAddress,
          poolPassword: "x"
        });
        break;
    }
    
    if (success) {
      // Show mining stats container
      const statsContainer = document.querySelector("#mining-stats-container") as HTMLElement;
      if (statsContainer) {
        statsContainer.style.display = "block";
      }
      
      // Update UI
      updateMiningUI(true);
      
      // Start polling for stats
      if (miningStatsInterval) {
        clearInterval(miningStatsInterval);
      }
      miningStatsInterval = setInterval(refreshMiningStats, 1000);
    } else {
      alert("Failed to start mining. Check your configuration.");
    }
  } catch (error) {
    console.error("Failed to start mining:", error);
    alert(`Failed to start mining: ${error}`);
  }
}

async function stopMining() {
  try {
    await invoke("wallet_stop_mining");
    
    // Hide mining stats container
    const statsContainer = document.querySelector("#mining-stats-container") as HTMLElement;
    if (statsContainer) {
      statsContainer.style.display = "none";
    }
    
    // Stop polling
    if (miningStatsInterval) {
      clearInterval(miningStatsInterval);
      miningStatsInterval = null;
    }
    
    // Update UI
    updateMiningUI(false);

  } catch (error) {
    console.error("Failed to stop mining:", error);
    alert(`Failed to stop mining: ${error}`);
  }
}

async function refreshMiningStats() {
  try {
    const statsJson = await invoke("get_mining_stats_json");
    const stats = JSON.parse(statsJson as string);
    updateMiningStatsDisplay(stats);
  } catch (error) {
    console.error("Failed to refresh mining stats:", error);
  }
}

function updateMiningUI(isMining: boolean) {
  const startBtn = document.querySelector("#start-mining-btn") as HTMLButtonElement;
  const stopBtn = document.querySelector("#stop-mining-btn") as HTMLButtonElement;

  if (startBtn && stopBtn) {
    startBtn.disabled = isMining;
    stopBtn.disabled = !isMining;
  }
  
  // Disable tab switching while mining
  document.querySelectorAll('.mining-tabs .tab').forEach(tab => {
    (tab as HTMLButtonElement).disabled = isMining;
  });
  
  // Disable all inputs while mining
  document.querySelectorAll('.mining-content input').forEach(input => {
    (input as HTMLInputElement).disabled = isMining;
  });
}

function formatHashrate(hashrate: number): string {
  if (hashrate < 1000) return `${hashrate.toFixed(2)} H/s`;
  if (hashrate < 1000000) return `${(hashrate / 1000).toFixed(2)} KH/s`;
  if (hashrate < 1000000000) return `${(hashrate / 1000000).toFixed(2)} MH/s`;
  return `${(hashrate / 1000000000).toFixed(2)} GH/s`;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateMiningStatsDisplay(stats: any) {
  // Update status
  const statusEl = document.querySelector("#mining-status") as HTMLElement;
  if (statusEl) {
    statusEl.textContent = stats.is_mining ? "Mining" : "Stopped";
    statusEl.style.color = stats.is_mining ? "#22c55e" : "#ef4444";
  }

  // Update individual stats
  const hashrateEl = document.querySelector("#hashrate") as HTMLElement;
  if (hashrateEl) {
    hashrateEl.textContent = formatHashrate(stats.hashrate);
  }

  const threadsEl = document.querySelector("#active-threads") as HTMLElement;
  if (threadsEl) {
    threadsEl.textContent = stats.threads.toString();
  }

  const hashesEl = document.querySelector("#total-hashes") as HTMLElement;
  if (hashesEl) {
    hashesEl.textContent = stats.total_hashes.toLocaleString();
  }

  const validSharesEl = document.querySelector("#valid-shares") as HTMLElement;
  if (validSharesEl) {
    validSharesEl.textContent = stats.valid_shares.toString();
  }

  const invalidSharesEl = document.querySelector("#invalid-shares") as HTMLElement;
  if (invalidSharesEl) {
    invalidSharesEl.textContent = stats.invalid_shares.toString();
  }

  const acceptanceRateEl = document.querySelector("#acceptance-rate") as HTMLElement;
  if (acceptanceRateEl) {
    acceptanceRateEl.textContent = `${stats.share_acceptance_rate.toFixed(2)}%`;
  }

  const uptimeEl = document.querySelector("#mining-uptime") as HTMLElement;
  if (uptimeEl) {
    uptimeEl.textContent = formatUptime(stats.uptime);
  }
}

// Set up mining tab switching
function setupMiningTabs() {
  const tabs = document.querySelectorAll('.mining-tabs .tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if ((tab as HTMLButtonElement).disabled) return;
      
      const tabId = tab.getAttribute('data-tab');
      if (!tabId) return;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update tab content
      tabContents.forEach(content => {
        if (content.id === `${tabId}-tab`) {
          content.classList.add('active');
        } else {
          content.classList.remove('active');
        }
      });
      
      currentMiningTab = tabId;
    });
  });
  
  // Thread slider
  const threadSlider = document.querySelector("#mining-threads") as HTMLInputElement;
  const threadCount = document.querySelector("#thread-count") as HTMLElement;
  
  if (threadSlider && threadCount) {
    // Set max threads based on CPU cores
    const maxThreads = navigator.hardwareConcurrency || 4;
    threadSlider.max = maxThreads.toString();
    threadSlider.value = Math.max(1, Math.floor(maxThreads / 2)).toString();
    threadCount.textContent = threadSlider.value;
    
    threadSlider.addEventListener('input', () => {
      threadCount.textContent = threadSlider.value;
    });
  }
}


// Mining state

// Initialize when DOM is loaded
window.addEventListener("DOMContentLoaded", () => {
  walletStatusEl = document.querySelector("#wallet-status");
  balanceEl = document.querySelector("#balance");
  addressEl = document.querySelector("#address");
  transactionsEl = document.querySelector("#transactions");
  networkStatusEl = document.querySelector("#network-status");

  // Mining elements

  // Header buttons removed (refresh/test)

  // Set up send transaction button
  document.querySelector("#send-btn")?.addEventListener("click", sendTransaction);

  // Set up mining controls
  setupMiningTabs();
  document.querySelector("#start-mining-btn")?.addEventListener("click", startMining);
  document.querySelector("#stop-mining-btn")?.addEventListener("click", stopMining);

  // Set up term deposits
  document.querySelector("#create-deposit-btn")?.addEventListener("click", () => createDeposit());

  // Initialize the app
  init();

  // Copy address on click
  const addressNode = document.querySelector('#address');
  addressNode?.addEventListener('click', async () => {
    try {
      const addr = (addressNode as HTMLElement).textContent || '';
      await navigator.clipboard.writeText(addr);
      showStatusUpdate('Address copied', 'success');
    } catch (e) {
      console.warn('Clipboard failed, using prompt fallback');
      const addr = (addressNode as HTMLElement).textContent || '';
      window.prompt('Copy address:', addr);
    }
  });
});
