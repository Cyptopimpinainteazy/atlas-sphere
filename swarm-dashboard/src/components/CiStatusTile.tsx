import React, { useEffect, useState } from 'react';

export interface CiStatusTileProps {
  rpcUrl: string;
  branch: string;
  pr?: number;
}

export interface CiStatus {
  status: 'success' | 'failed' | 'pending' | 'unknown';
  lastRun?: number;
  message: string;
}

export const CiStatusTile: React.FC<CiStatusTileProps> = ({ rpcUrl, branch, pr }) => {
  const [ciStatus, setCiStatus] = useState<CiStatus>({
    status: 'unknown',
    message: 'Loading...',
  });

  useEffect(() => {
    const fetchCiStatus = async (): Promise<void> => {
      try {
        // Mock CI status - replace with actual GitHub API call
        const mockStatus: CiStatus = {
          status: 'success',
          lastRun: Date.now() - 300000,
          message: `Last build successful on ${branch}`,
        };
        setCiStatus(mockStatus);
      } catch (_err) {
        setCiStatus({
          status: 'failed',
          message: _err instanceof Error ? _err.message : 'Unknown error',
        });
      }
    };

    fetchCiStatus();
  }, [branch, pr, rpcUrl]);

  const getStatusColor = (): string => {
    switch (ciStatus.status) {
      case 'success':
        return '#4caf50';
      case 'failed':
        return '#ff6b6b';
      case 'pending':
        return '#ffd700';
      default:
        return '#888';
    }
  };

  const getStatusIcon = (): string => {
    switch (ciStatus.status) {
      case 'success':
        return '✓';
      case 'failed':
        return '✗';
      case 'pending':
        return '○';
      default:
        return '?';
    }
  };

  return (
    <div className="ci-status-tile">
      <h4>🔧 CI Status</h4>
      <div className="ci-content">
        <div className="status-indicator" style={{ color: getStatusColor() }}>
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">{ciStatus.status.toUpperCase()}</span>
        </div>
        <p className="status-message">{ciStatus.message}</p>
        {pr && <p className="pr-info">PR #{pr}</p>}
      </div>
      <style jsx>{`
        .ci-status-tile {
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

        .ci-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: bold;
          font-size: 14px;
        }

        .status-icon {
          font-size: 16px;
        }

        .status-message {
          margin: 0;
          font-size: 12px;
          color: #888;
        }

        .pr-info {
          margin: 0;
          font-size: 11px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default CiStatusTile;
