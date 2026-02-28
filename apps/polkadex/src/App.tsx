import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [connected, setConnected] = useState(false)
  const [blockchainStatus, setBlockchainStatus] = useState('Checking...')

useEffect(() => {
    // Check X3 Chain blockchain connection
    const checkBlockchain = async () => {
      try {
        const wsUrl = 'ws://localhost:9944'
        const ws = new WebSocket(wsUrl)
        
        ws.onopen = () => {
          setConnected(true)
          setBlockchainStatus('Connected to X3 Chain')
          ws.close()
        }
        
        ws.onerror = () => {
          setConnected(false)
          setBlockchainStatus('X3 Chain node offline')
        }
      } catch (error) {
        setBlockchainStatus('Connection error')
      }
    }
    
    checkBlockchain()
    const interval = setInterval(checkBlockchain, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔷 Polkadex Integration</h1>
        <h2>X3 Chain DEX</h2>
        
        <div className="status-box">
          <div className={`status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢' : '🔴'} {blockchainStatus}
          </div>
        </div>

        <div className="info-section">
          <h3>Polkadex Features:</h3>
          <ul>
            <li>✅ Decentralized Order Book</li>
            <li>✅ AMM Pools</li>
            <li>✅ Cross-chain Trading</li>
            <li>✅ Low Latency Matching Engine</li>
            <li>✅ Non-custodial Trading</li>
          </ul>
        </div>

        <div className="connect-section">
          <button className="connect-btn" disabled={!connected}>
            {connected ? 'Connect Wallet' : 'Waiting for Blockchain...'}
          </button>
        </div>

        <p className="info-text">
          Polkadex DEX running on X3 Chain blockchain
        </p>
      </header>
    </div>
  )
}

export default App
