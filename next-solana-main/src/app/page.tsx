'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ 
      width: '100%',
      minHeight: '100vh',
      padding: '40px', 
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '3em', marginBottom: '20px', color: '#00ff00' }}>
        🚀 Atlas Sphere DEX
      </h1>
      <p style={{ fontSize: '1.5em', color: '#cccccc', marginBottom: '30px' }}>
        Cross-Chain Atomic Trading on Solana + Atlas Sphere
      </p>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        maxWidth: '800px',
        width: '100%',
        marginBottom: '40px'
      }}>
        {/* Cross-Chain Swap - Primary Feature */}
        <Link href="/cross-chain" style={{ 
          color: '#fff', 
          textDecoration: 'none',
          fontSize: '1.2em',
          padding: '20px 24px',
          border: '2px solid #00ff88',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 255, 136, 0.15)',
          transition: 'all 0.2s ease'
        }}>
          <span style={{ fontSize: '2em', marginBottom: '8px' }}>⚡</span>
          <span style={{ fontWeight: 'bold', color: '#00ff88' }}>Cross-Chain Swap</span>
          <span style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px' }}>Atomic trades across chains</span>
        </Link>

        {/* X3VM */}
        <Link href="/x3vm" style={{ 
          color: '#fff', 
          textDecoration: 'none',
          fontSize: '1.2em',
          padding: '20px 24px',
          border: '2px solid #ff6600',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 102, 0, 0.15)',
          transition: 'all 0.2s ease'
        }}>
          <span style={{ fontSize: '2em', marginBottom: '8px' }}>🔷</span>
          <span style={{ fontWeight: 'bold', color: '#ff6600' }}>X3VM Executor</span>
          <span style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px' }}>On-chain program execution</span>
        </Link>

        {/* Basic */}
        <Link href="/basic" style={{ 
          color: '#00ffff', 
          textDecoration: 'none',
          fontSize: '1.2em',
          padding: '20px 24px',
          border: '2px solid #00ffff',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 255, 255, 0.1)',
          transition: 'all 0.2s ease'
        }}>
          <span style={{ fontSize: '2em', marginBottom: '8px' }}>📦</span>
          <span style={{ fontWeight: 'bold' }}>Basic App</span>
          <span style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px' }}>Simple Solana interactions</span>
        </Link>

        {/* AI Trading */}
        <Link href="/ai" style={{ 
          color: '#fff', 
          textDecoration: 'none',
          fontSize: '1.2em',
          padding: '20px 24px',
          border: '2px solid #9945FF',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'rgba(153, 69, 255, 0.15)',
          transition: 'all 0.2s ease'
        }}>
          <span style={{ fontSize: '2em', marginBottom: '8px' }}>🤖</span>
          <span style={{ fontWeight: 'bold', color: '#9945FF' }}>AI Trading</span>
          <span style={{ fontSize: '0.8em', color: '#aaa', marginTop: '4px' }}>ML-powered analysis</span>
        </Link>
      </div>

      {/* Atlas Sphere Status */}
      <div style={{
        padding: '16px 24px',
        borderRadius: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        color: '#888',
        fontSize: '0.9em',
        maxWidth: '600px'
      }}>
        <span style={{ color: '#00ff88' }}>●</span> Atlas Sphere Testnet: <a 
          href="http://rpc.testnet.atlas-sphere.io:9944" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: '#00ffff' }}
        >rpc.testnet.atlas-sphere.io:9944</a>
        {' | '}
        <a 
          href="https://faucet.testnet.atlas-sphere.io" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: '#00ff88' }}
        >Get Testnet Tokens</a>
      </div>
    </div>
  )
}
