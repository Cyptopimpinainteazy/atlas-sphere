import React, { useEffect, useState } from 'react';

export interface TestnetReadinessTileProps {
  rpcUrl: string;
}

export interface TestnetStatus {
  networkHealth: number;
  nodesOnline: number;
  totalNodes: number;
  blockHeight: number;
  transactionRate: number;
  averageLatency: number;
  lastUpdate: number;
}

export const TestnetReadinessTile: React.FC<TestnetReadinessTileProps> = ({ rpcUrl }) => {
  const [status, setStatus] = useState<TestnetStatus>({
    networkHealth: 0,
    nodesOnline: 0,
    totalNodes: 0,
    blockHeight: 0,
    transactionRate: 0,
    averageLatency: 0,
    lastUpdate: Date.now(),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const fetchTestnetStatus = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(undefined);
        // Mock testnet data - replace with actual RPC call
        const mockStatus: TestnetStatus = {
          networkHealth: 98,
          nodesOnline: 23,
          totalNodes: 24,
          blockHeight: 1250000,
          transactionRate: 450,
          averageLatency: 120,
          lastUpdate: Date.now(),
        };
        setStatus(mockStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchTestnetStatus();
    const interval = setInterval(fetchTestnetStatus, 60000);
    return () => clearInterval(interval);
  }, [rpcUrl]);

  const getHealthColor = (): string => {
    if (status.networkHealth >= 95) return '#4caf50';
    if (status.networkHealth >= 80) return '#ffd700';
    return '#ff6b6b';
  };

  const getHealthStatus = (): string => {
    if (status.networkHealth >= 95) return 'Excellent';
    if (status.networkHealth >= 80) return 'Good';
    if (status.networkHealth >= 60) return 'Fair';
    return 'Poor';
  };

  if (error) {
    return (
      <div className="testnet-readiness-tile error">
        <h4>🌐 Testnet Status</h4>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  return (
    <div className="testnet-readiness-tile">
      <h4>🌐 Testnet Readiness</h4>
      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <div className="testnet-content">
          <div className="health-section">
            <div
              className="health-indicator"
              style={{
                backgroundColor: getHealthColor(),
              }}
            >
              <span className="health-percentage">{status.networkHealth}%</span>
            </div>
            <div className="health-label">{getHealthStatus()}</div>
          </div>

          <div className="metrics-section">
            <div className="metric-row">
              <span className="metric-label">Nodes Online</span>
              <span className="metric-value">
                {status.nodesOnline}/{status.totalNodes}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Block Height</span>
              <span className="metric-value">{status.blockHeight.toLocaleString()}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Tx/sec</span>
              <span className="metric-value">{status.transactionRate}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Latency</span>
              <span className="metric-value">{status.averageLatency}ms</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .testnet-readiness-tile {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 16px;
          color: #e0e0e0;
          border: 1px solid #333;
        }

        .testnet-readiness-tile.error {
          background: rgba(255, 107, 107, 0.1);
          border-color: #ff6b6b;
        }

        h4 {
          margin: 0 0 12px 0;
          color: #00d4ff;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .loading {
          margin: 0;
          font-size: 12px;
          color: #888;
        }

        .error-message {
          margin: 0;
          font-size: 11px;
          color: #ff6b6b;
        }

        .testnet-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .health-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .health-indicator {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .health-percentage {
          font-size: 20px;
          font-weight: bold;
          color: #000;
        }

        .health-label {
          font-size: 12px;
          color: #aaa;
          text-transform: uppercase;
          font-weight: 500;
        }

        .metrics-section {
          display: grid;
          gap: 6px;
          padding-top: 12px;
          border-top: 1px solid #333;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
        }

        .metric-label {
          color: #888;
          text-transform: uppercase;
        }

        .metric-value {
          color: #00d4ff;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default TestnetReadinessTile;
