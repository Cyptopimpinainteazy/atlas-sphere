import React, { useEffect, useState } from 'react';

export function TestnetReadinessTile({ rpcUrl = 'http://localhost:9944', pollInterval = 30000 }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function fetchData() {
            try {
                setLoading(true);
                const res = await fetch(`${rpcUrl}/api/readiness/testnet`);
                const json = await res.json();
                if (!mounted) return;
                setData(json);
            } catch (err) {
                if (!mounted) return;
                setData(null);
            } finally {
                if (!mounted) return;
                setLoading(false);
            }
        }

        fetchData();
        const t = setInterval(fetchData, pollInterval);
        return () => { mounted = false; clearInterval(t); };
    }, [rpcUrl, pollInterval]);

    if (loading) {
        return (
            <div className="readiness-tile">
                <h4>Testnet Readiness</h4>
                <p>Loading...</p>
                <style jsx>{`
                    .readiness-tile { background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid #333 }
                `}</style>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="readiness-tile">
                <h4>Testnet Readiness</h4>
                <p>Failed to load data</p>
                <style jsx>{`
                    .readiness-tile { background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid #333 }
                `}</style>
            </div>
        );
    }

    const score = data.score;
    const friendly = score > 80 ? 'Good' : score > 50 ? 'Warning' : 'Critical';

    return (
        <div className="readiness-tile">
            <h4>Testnet Readiness</h4>
            <div className="score-row">
                <div className="score">{Math.round(score)}</div>
                <div className="status">{friendly}</div>
            </div>

            <div className="details">
                <div><strong>CI:</strong> {data.ci?.status || 'unknown'}</div>
                <div><strong>Node synced:</strong> {data.node?.synced ? 'yes' : 'no'}</div>
                <div><strong>Peers:</strong> {data.network?.peers ?? 'n/a'}</div>
                <div><strong>Failing tests:</strong> {((data.tests?.unit?.failed || 0) + (data.tests?.integration?.failed || 0))}</div>
            </div>

            <div style={{ marginTop: 8 }}>
                <a className="link" href="#" onClick={(e) => { e.preventDefault(); window.open(data.ci?.details || data.ci?.link || '#', '_blank'); }}>Open CI Details</a>
                <span style={{ margin: '0 8px' }}>|</span>
                <a className="link" href="#" onClick={(e) => { e.preventDefault(); window.open('/artifacts', '_blank'); }}>Artifacts</a>
            </div>

            <style jsx>{`
                .readiness-tile { background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid #333 }
                .score-row { display:flex; align-items:center; gap:12px }
                .score { font-size: 28px; color: #00d4ff; font-weight:700 }
                .status { font-size: 12px; color: #888 }
                .details { margin-top:8px; font-size: 12px; color: #ccc }
                .link { color: #00d4ff; font-size: 12px; margin-right: 6px }
            `}</style>
        </div>
    );
}
