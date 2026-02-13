/**
 * DexOrderbookPanel — full orderbook DEX with price ladder, depth chart, and order entry.
 *
 * Features:
 * - Live orderbook with bid/ask sides
 * - Spread indicator and mid-price
 * - Limit & market order entry
 * - Recent fills / trade history
 * - Pair selector
 */
import React, { useState, useMemo } from 'react';

/* ── Types ─────────────────────────────────────────── */
interface OrderLevel {
  price: number;
  size: number;
  total: number;
}

interface Fill {
  id: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  time: string;
}

interface Pair {
  symbol: string;
  base: string;
  quote: string;
  lastPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  vol24h: string;
}

/* ── Mock Data ─────────────────────────────────────── */
const PAIRS: Pair[] = [
  { symbol: 'ATLAS/USDC', base: 'ATLAS', quote: 'USDC', lastPrice: 1.2512, change24h: 5.23, high24h: 1.2890, low24h: 1.1845, vol24h: '4.2M' },
  { symbol: 'ETH/USDC',   base: 'ETH',   quote: 'USDC', lastPrice: 3245.80, change24h: -1.12, high24h: 3302.00, low24h: 3189.50, vol24h: '12.8M' },
  { symbol: 'SOL/USDC',   base: 'SOL',   quote: 'USDC', lastPrice: 178.42, change24h: 3.71, high24h: 182.10, low24h: 171.30, vol24h: '6.1M' },
  { symbol: 'ATLAS/ETH',  base: 'ATLAS', quote: 'ETH',  lastPrice: 0.000385, change24h: 6.14, high24h: 0.000398, low24h: 0.000361, vol24h: '890K' },
  { symbol: 'SOL/ETH',    base: 'SOL',   quote: 'ETH',  lastPrice: 0.05495, change24h: 4.88, high24h: 0.05610, low24h: 0.05220, vol24h: '310K' },
];

function generateOrderbook(mid: number): { asks: OrderLevel[]; bids: OrderLevel[] } {
  const asks: OrderLevel[] = [];
  const bids: OrderLevel[] = [];
  let askTotal = 0;
  let bidTotal = 0;
  const step = mid * 0.001;
  for (let i = 0; i < 15; i++) {
    const askSize = Math.round((Math.random() * 5000 + 200));
    askTotal += askSize;
    asks.push({ price: +(mid + step * (i + 1)).toFixed(6), size: askSize, total: askTotal });

    const bidSize = Math.round((Math.random() * 5000 + 200));
    bidTotal += bidSize;
    bids.push({ price: +(mid - step * (i + 1)).toFixed(6), size: bidSize, total: bidTotal });
  }
  return { asks: asks.reverse(), bids }; // asks high→low (reversed for display top-down)
}

const MOCK_FILLS: Fill[] = [
  { id: 1,  price: 1.2512, size: 3200,  side: 'buy',  time: '14:32:01' },
  { id: 2,  price: 1.2508, size: 1800,  side: 'sell', time: '14:31:58' },
  { id: 3,  price: 1.2510, size: 5400,  side: 'buy',  time: '14:31:55' },
  { id: 4,  price: 1.2505, size: 900,   side: 'sell', time: '14:31:52' },
  { id: 5,  price: 1.2515, size: 2200,  side: 'buy',  time: '14:31:48' },
  { id: 6,  price: 1.2503, size: 4100,  side: 'sell', time: '14:31:44' },
  { id: 7,  price: 1.2518, size: 1500,  side: 'buy',  time: '14:31:40' },
  { id: 8,  price: 1.2500, size: 6800,  side: 'sell', time: '14:31:36' },
  { id: 9,  price: 1.2520, size: 980,   side: 'buy',  time: '14:31:30' },
  { id: 10, price: 1.2498, size: 3300,  side: 'sell', time: '14:31:25' },
];

/* ── Component ─────────────────────────────────────── */
const DexOrderbookPanel: React.FC = () => {
  const [selectedPair, setSelectedPair] = useState(PAIRS[0]);
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [limitPrice, setLimitPrice] = useState(selectedPair.lastPrice.toString());
  const [orderSize, setOrderSize] = useState('');
  const [showPairList, setShowPairList] = useState(false);
  const [tab, setTab] = useState<'book' | 'fills'>('book');

  const orderbook = useMemo(() => generateOrderbook(selectedPair.lastPrice), [selectedPair]);

  const maxTotal = Math.max(
    orderbook.asks[0]?.total ?? 0,
    orderbook.bids[orderbook.bids.length - 1]?.total ?? 0,
  );

  const spread = orderbook.bids[0] && orderbook.asks[orderbook.asks.length - 1]
    ? +(orderbook.asks[orderbook.asks.length - 1].price - orderbook.bids[0].price).toFixed(6)
    : 0;

  const estTotal = orderSize
    ? (parseFloat(orderSize) * (orderType === 'limit' ? parseFloat(limitPrice) : selectedPair.lastPrice)).toFixed(4)
    : '0';

  const selectPair = (p: Pair) => {
    setSelectedPair(p);
    setLimitPrice(p.lastPrice.toString());
    setShowPairList(false);
  };

  const formatPrice = (n: number) => {
    if (n >= 1) return n.toFixed(4);
    if (n >= 0.001) return n.toFixed(6);
    return n.toFixed(8);
  };

  /* ── Styles (inline for panel context) ── */
  const s = {
    root: { display: 'flex', flexDirection: 'column' as const, height: '100%', background: '#0a0e17', color: '#e0e0e0', fontFamily: 'monospace', fontSize: '0.78rem', overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #1a1f2e', flexShrink: 0 },
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    bookCol: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
    orderCol: { width: 240, borderLeft: '1px solid #1a1f2e', display: 'flex', flexDirection: 'column' as const, overflow: 'auto', padding: '8px 10px' },
    row: { display: 'flex', alignItems: 'center', padding: '1px 10px', position: 'relative' as const, cursor: 'pointer' },
    spreadBar: { textAlign: 'center' as const, padding: '4px 0', fontSize: '0.7rem', color: '#888', borderTop: '1px solid #1a1f2e', borderBottom: '1px solid #1a1f2e', flexShrink: 0 },
  };

  return (
    <div style={s.root}>
      {/* ── Header: Pair selector + stats ── */}
      <div style={s.header}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPairList(!showPairList)}
            style={{ background: '#141824', border: '1px solid #2a2f3e', borderRadius: 6, padding: '4px 10px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {selectedPair.symbol} ▾
          </button>
          {showPairList && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPairList(false)} />
              <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 50, background: '#141824', border: '1px solid #2a2f3e', borderRadius: 8, minWidth: 200, padding: 4 }}>
                {PAIRS.map(p => (
                  <button key={p.symbol} onClick={() => selectPair(p)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 'none', color: p.symbol === selectedPair.symbol ? '#00e5ff' : '#ccc', cursor: 'pointer', fontSize: '0.8rem', borderRadius: 4 }}
                    onMouseOver={e => (e.currentTarget.style.background = '#1e2436')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontWeight: 600 }}>{p.symbol}</span>
                    <span style={{ float: 'right', color: p.change24h >= 0 ? '#4caf50' : '#ef5350' }}>
                      {p.change24h >= 0 ? '+' : ''}{p.change24h.toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: selectedPair.change24h >= 0 ? '#4caf50' : '#ef5350' }}>
          {formatPrice(selectedPair.lastPrice)}
        </span>
        <span style={{ color: selectedPair.change24h >= 0 ? '#4caf50' : '#ef5350', fontSize: '0.75rem' }}>
          {selectedPair.change24h >= 0 ? '▲' : '▼'} {Math.abs(selectedPair.change24h).toFixed(2)}%
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem', color: '#777' }}>
          <span>H: {formatPrice(selectedPair.high24h)}</span>
          <span>L: {formatPrice(selectedPair.low24h)}</span>
          <span>Vol: {selectedPair.vol24h}</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a1f2e', flexShrink: 0 }}>
        {(['book', 'fills'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '5px 0', background: 'transparent', border: 'none', borderBottom: tab === t ? '2px solid #00e5ff' : '2px solid transparent', color: tab === t ? '#00e5ff' : '#777', cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
            {t === 'book' ? '📊 Orderbook' : '🔄 Trades'}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div style={s.body}>
        {/* Left: Book or Fills */}
        <div style={s.bookCol}>
          {tab === 'book' ? (
            <>
              {/* Column headers */}
              <div style={{ display: 'flex', padding: '4px 10px', fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>
                <span style={{ flex: 1 }}>Price ({selectedPair.quote})</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Size ({selectedPair.base})</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Total</span>
              </div>

              {/* Asks (sells) */}
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                {orderbook.asks.map((lvl, i) => (
                  <div key={`a${i}`} style={s.row}
                    onClick={() => { setLimitPrice(lvl.price.toString()); setOrderSide('buy'); }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: 'rgba(239,83,80,0.08)', width: `${(lvl.total / maxTotal) * 100}%` }} />
                    <span style={{ flex: 1, color: '#ef5350', zIndex: 1 }}>{formatPrice(lvl.price)}</span>
                    <span style={{ flex: 1, textAlign: 'right', zIndex: 1 }}>{lvl.size.toLocaleString()}</span>
                    <span style={{ flex: 1, textAlign: 'right', color: '#777', zIndex: 1 }}>{lvl.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              {/* Spread */}
              <div style={s.spreadBar as React.CSSProperties}>
                Spread: {formatPrice(spread)} ({((spread / selectedPair.lastPrice) * 100).toFixed(3)}%)
              </div>

              {/* Bids (buys) */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {orderbook.bids.map((lvl, i) => (
                  <div key={`b${i}`} style={s.row}
                    onClick={() => { setLimitPrice(lvl.price.toString()); setOrderSide('sell'); }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, background: 'rgba(76,175,80,0.08)', width: `${(lvl.total / maxTotal) * 100}%` }} />
                    <span style={{ flex: 1, color: '#4caf50', zIndex: 1 }}>{formatPrice(lvl.price)}</span>
                    <span style={{ flex: 1, textAlign: 'right', zIndex: 1 }}>{lvl.size.toLocaleString()}</span>
                    <span style={{ flex: 1, textAlign: 'right', color: '#777', zIndex: 1 }}>{lvl.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Fills / Trade History */
            <div style={{ overflow: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', padding: '4px 10px', fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                <span style={{ flex: 1 }}>Price</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Size</span>
                <span style={{ flex: 1, textAlign: 'right' }}>Time</span>
              </div>
              {MOCK_FILLS.map(f => (
                <div key={f.id} style={{ display: 'flex', padding: '2px 10px' }}>
                  <span style={{ flex: 1, color: f.side === 'buy' ? '#4caf50' : '#ef5350' }}>{formatPrice(f.price)}</span>
                  <span style={{ flex: 1, textAlign: 'right' }}>{f.size.toLocaleString()}</span>
                  <span style={{ flex: 1, textAlign: 'right', color: '#777' }}>{f.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Order Entry */}
        <div style={s.orderCol}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.85rem' }}>Place Order</div>

          {/* Buy / Sell toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => setOrderSide('buy')}
              style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                background: orderSide === 'buy' ? '#4caf50' : '#1e2436', color: orderSide === 'buy' ? '#fff' : '#777' }}>
              Buy
            </button>
            <button onClick={() => setOrderSide('sell')}
              style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                background: orderSide === 'sell' ? '#ef5350' : '#1e2436', color: orderSide === 'sell' ? '#fff' : '#777' }}>
              Sell
            </button>
          </div>

          {/* Order type */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(['limit', 'market'] as const).map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: orderType === t ? '1px solid #00e5ff' : '1px solid #2a2f3e', background: 'transparent', color: orderType === t ? '#00e5ff' : '#777', cursor: 'pointer', fontSize: '0.72rem', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>

          {/* Price (limit only) */}
          {orderType === 'limit' && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: '0.65rem', color: '#777', textTransform: 'uppercase', letterSpacing: 1 }}>
                Price ({selectedPair.quote})
              </label>
              <input value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', background: '#0d1117', border: '1px solid #2a2f3e', borderRadius: 6, color: '#fff', fontSize: '0.82rem', marginTop: 2, fontFamily: 'monospace' }} />
            </div>
          )}

          {/* Size */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: '0.65rem', color: '#777', textTransform: 'uppercase', letterSpacing: 1 }}>
              Amount ({selectedPair.base})
            </label>
            <input value={orderSize} onChange={e => setOrderSize(e.target.value)} placeholder="0.00"
              style={{ width: '100%', padding: '6px 8px', background: '#0d1117', border: '1px solid #2a2f3e', borderRadius: 6, color: '#fff', fontSize: '0.82rem', marginTop: 2, fontFamily: 'monospace' }} />
          </div>

          {/* Quick size buttons */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {['25%', '50%', '75%', '100%'].map(pct => (
              <button key={pct}
                style={{ flex: 1, padding: '3px 0', borderRadius: 4, border: '1px solid #2a2f3e', background: 'transparent', color: '#777', cursor: 'pointer', fontSize: '0.65rem' }}
                onClick={() => setOrderSize((parseInt(pct) * 100).toString())}
              >{pct}</button>
            ))}
          </div>

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 10, color: '#999' }}>
            <span>Total</span>
            <span>{estTotal} {selectedPair.quote}</span>
          </div>

          {/* Submit */}
          <button
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              background: orderSide === 'buy' ? '#4caf50' : '#ef5350', color: '#fff',
            }}
            onClick={() => alert(`${orderType.toUpperCase()} ${orderSide.toUpperCase()}: ${orderSize} ${selectedPair.base} @ ${orderType === 'limit' ? limitPrice : 'MKT'}`)}
          >
            {orderSide === 'buy' ? 'Buy' : 'Sell'} {selectedPair.base}
          </button>

          {/* Open orders placeholder */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#777', marginBottom: 4 }}>Open Orders</div>
            <div style={{ fontSize: '0.7rem', color: '#555', textAlign: 'center', padding: 12 }}>No open orders</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DexOrderbookPanel;
