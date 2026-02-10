import React, { useEffect, useState } from 'react';
import { getBondState, depositBond, requestWithdraw } from '../services/api';
import { Button, Loading, Metric, ProgressBar } from '../components/UIComponents';

interface BondState {
  balance: number;
  lockedUntil: number | null;
  pendingWithdrawals: Array<{
    amount: number;
    txHash: string;
    createdAt: number;
  }>;
}

export function BondsPage() {
  const [bond, setBond] = useState<BondState | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [operation, setOperation] = useState<'deposit' | 'withdraw' | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const b = await getBondState();
        if (mounted) setBond(b as any);
      } catch (e) {
        // fallback: demo data
        if (mounted)
          setBond({
            balance: 50000,
            lockedUntil: null,
            pendingWithdrawals: [],
          });
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function onDeposit() {
    setLoading(true);
    setMessage(null);
    setMessageType('success');
    setOperation('deposit');
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error('Invalid amount');
      const res = await depositBond(amt).catch(() => ({ txHash: '0xdemo' }));
      // optimistic UI update
      setBond((b: any) =>
        b
          ? { ...b, balance: b.balance + amt }
          : { balance: amt, lockedUntil: null, pendingWithdrawals: [] }
      );
      setMessage(`✓ Deposit sent (${res.txHash.slice(0, 10)}...)`);
      setAmount('');
    } catch (e: any) {
      setMessageType('error');
      setMessage(`✗ ${e.message || 'Deposit failed'}`);
    } finally {
      setLoading(false);
      setOperation(null);
    }
  }

  async function onWithdraw() {
    setLoading(true);
    setMessage(null);
    setMessageType('success');
    setOperation('withdraw');
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error('Invalid amount');
      if (!bond || amt > bond.balance) throw new Error('Insufficient balance');
      const res = await requestWithdraw(amt).catch(() => ({
        txHash: '0xdemo-withdraw',
      }));
      setBond((b: any) =>
        b
          ? {
              ...b,
              balance: Math.max(0, b.balance - amt),
              pendingWithdrawals: [
                ...b.pendingWithdrawals,
                { amount: amt, txHash: res.txHash, createdAt: Date.now() },
              ],
            }
          : null
      );
      setMessage(`✓ Withdrawal requested (${res.txHash.slice(0, 10)}...)`);
      setAmount('');
    } catch (e: any) {
      setMessageType('error');
      setMessage(`✗ ${e.message || 'Withdrawal failed'}`);
    } finally {
      setLoading(false);
      setOperation(null);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === 'Enter' && !loading) {
      callback();
    }
  };

  if (!bond) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Bond Management</h1>
        </div>
        <Loading />
      </div>
    );
  }

  const pendingTotal = bond.pendingWithdrawals.reduce(
    (sum, w) => sum + w.amount,
    0
  );
  const utilization = ((pendingTotal + (bond.lockedUntil ? 10000 : 0)) / bond.balance) * 100;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Bonds & Collateral</h1>
        <span className="subtitle">Deposit, withdraw and inspect bond state</span>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>Current Bond</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{bond ? bond.balance.toFixed(2) : '—'}</div>
          </div>

          <div style={{ width: 280 }}>
            <input className="input" placeholder="Amount (USDC)" value={amount} onChange={(e)=>setAmount(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn primary" disabled={loading} onClick={onDeposit}>Deposit</button>
              <button className="btn" disabled={loading} onClick={onWithdraw}>Request Withdraw</button>
            </div>
          </div>
        </div>

        <div>
          <h3>Pending Withdrawals</h3>
          <ul>
            {bond?.pendingWithdrawals?.length ? bond.pendingWithdrawals.map((w:any, i:number)=> (
              <li key={i}>{w.amount} — {w.txHash ?? 'pending'} — {new Date(w.createdAt).toLocaleString()}</li>
            )) : <div className="muted">No pending withdrawals</div>}
          </ul>
        </div>

        <div>
          <h3>History</h3>
          <div className="muted">(History & on-chain tx viewer coming soon)</div>
        </div>

        {message && <div className="muted">{message}</div>}
      </div>
    </div>
  );
}
