import React, { useEffect, useState } from 'react';

export interface TestHealthTileProps {
  rpcUrl: string;
}

export interface TestHealth {
  unitTests: { passed: number; failed: number; skipped: number };
  integrationTests: { passed: number; failed: number; skipped: number };
  coverage: number;
  lastRun?: number;
}

export const TestHealthTile: React.FC<TestHealthTileProps> = ({ rpcUrl }) => {
  const [health, setHealth] = useState<TestHealth>({
    unitTests: { passed: 0, failed: 0, skipped: 0 },
    integrationTests: { passed: 0, failed: 0, skipped: 0 },
    coverage: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTestHealth = async (): Promise<void> => {
      try {
        // Mock test data - replace with actual CI API call
        const mockHealth: TestHealth = {
          unitTests: { passed: 45, failed: 0, skipped: 2 },
          integrationTests: { passed: 12, failed: 0, skipped: 1 },
          coverage: 92,
          lastRun: Date.now() - 600000,
        };
        setHealth(mockHealth);
      } catch (error) {
        console.error('Failed to fetch test health:', error);
        setHealth({
          unitTests: { passed: 0, failed: 1, skipped: 0 },
          integrationTests: { passed: 0, failed: 0, skipped: 0 },
          coverage: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTestHealth();
  }, [rpcUrl]);

  const totalTests =
    health.unitTests.passed +
    health.unitTests.failed +
    health.integrationTests.passed +
    health.integrationTests.failed;
  const passRate = totalTests > 0 ? ((health.unitTests.passed + health.integrationTests.passed) / totalTests * 100).toFixed(0) : '0';

  const getCoverageColor = (): string => {
    if (health.coverage >= 90) return '#4caf50';
    if (health.coverage >= 70) return '#ffd700';
    return '#ff6b6b';
  };

  return (
    <div className="test-health-tile">
      <h4>🧪 Test Health</h4>
      {loading ? (
        <p className="loading">Loading...</p>
      ) : (
        <div className="health-content">
          <div className="metric">
            <span className="metric-label">Pass Rate</span>
            <span className="metric-value">{passRate}%</span>
          </div>
          <div className="metric">
            <span className="metric-label">Coverage</span>
            <span className="metric-value" style={{ color: getCoverageColor() }}>
              {health.coverage}%
            </span>
          </div>
          <div className="test-summary">
            <div className="test-group">
              <div className="test-label">Unit Tests</div>
              <div className="test-counts">
                <span className="passed">{health.unitTests.passed}✓</span>
                {health.unitTests.failed > 0 && (
                  <span className="failed">{health.unitTests.failed}✗</span>
                )}
              </div>
            </div>
            <div className="test-group">
              <div className="test-label">Integration</div>
              <div className="test-counts">
                <span className="passed">{health.integrationTests.passed}✓</span>
                {health.integrationTests.failed > 0 && (
                  <span className="failed">{health.integrationTests.failed}✗</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .test-health-tile {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 16px;
          color: #e0e0e0;
          border: 1px solid #333;
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

        .health-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .metric-label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
        }

        .metric-value {
          font-size: 16px;
          font-weight: bold;
          color: #00d4ff;
        }

        .test-summary {
          display: grid;
          gap: 8px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #333;
        }

        .test-group {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
        }

        .test-label {
          color: #888;
          text-transform: uppercase;
        }

        .test-counts {
          display: flex;
          gap: 8px;
        }

        .passed {
          color: #4caf50;
          font-weight: bold;
        }

        .failed {
          color: #ff6b6b;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default TestHealthTile;
