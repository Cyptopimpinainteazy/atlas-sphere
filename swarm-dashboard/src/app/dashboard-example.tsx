/**
 * Dashboard Integration Example
 *
 * Shows how to integrate the MediaProductionPanel component
 * with the dashboard application
 */

import React, { useState } from 'react';
import { MediaProductionPanel } from '../components/MediaProductionPanel';
import { useMediaMetrics } from '../hooks/useMediaMetrics';
import { CiStatusTile } from '../components/CiStatusTile';
import { TestHealthTile } from '../components/TestHealthTile';
import { AlertsPanel } from '../components/AlertsPanel';
import { TestnetReadinessTile } from '../components/TestnetReadinessTile';

/**
 * Enhanced dashboard page with period selector and metrics view
 */
export default function DashboardPage() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:9944';
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  return (
    <div className="dashboard-layout">
      {/* Header */}
      <DashboardHeader selectedPeriod={selectedPeriod} onPeriodChange={setSelectedPeriod} />

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Production Panel */}
        <MediaProductionPanel rpcUrl={rpcUrl} pollInterval={30000} />

        {/* Metrics Panel */}
        <MetricsPanel rpcUrl={rpcUrl} period={selectedPeriod} />
      </div>

      {/* Sidebar */}
      <div className="dashboard-sidebar">
        <QuickStats rpcUrl={rpcUrl} />
        <CiStatusTile rpcUrl={rpcUrl} branch="feature/swarm-dashboard-e2e" pr={3} />
        <TestHealthTile rpcUrl={rpcUrl} />
        <TestnetReadinessTile rpcUrl={rpcUrl} />
        <AlertsPanel rpcUrl={rpcUrl} />
      </div>

      <style jsx>{`
        .dashboard-layout {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 24px;
          padding: 24px;
          background: #0a0e27;
          min-height: 100vh;
        }

        .dashboard-content {
          grid-column: 1;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .dashboard-sidebar {
          grid-column: 2;
          grid-row: 1 / 3;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        @media (max-width: 1200px) {
          .dashboard-layout {
            grid-template-columns: 1fr;
            gap: 16px;
            padding: 16px;
          }

          .dashboard-sidebar {
            grid-column: 1;
            grid-row: auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Dashboard header with period selector
 */
function DashboardHeader({
  selectedPeriod,
  onPeriodChange,
}) {
  const periods: MetricsPeriod[] = ['day', 'week', 'month', 'quarter', 'year'];

  return (
    <header className="dashboard-header">
      <div className="header-content">
        <h1>📺 Media Production Dashboard</h1>
        <p className="header-subtitle">Real-time orchestration and metrics</p>
      </div>

      <div className="period-selector">
        <span className="selector-label">Metrics Period:</span>
        {periods.map((period) => (
          <button
            key={period}
            className={`period-button ${selectedPeriod === period ? 'active' : ''}`}
            onClick={() => onPeriodChange(period)}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      <style jsx>{`
        .dashboard-header {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          border: 1px solid #333;
        }

        .header-content h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          color: #00d4ff;
        }

        .header-subtitle {
          margin: 0;
          color: #888;
          font-size: 14px;
        }

        .period-selector {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .selector-label {
          color: #888;
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .period-button {
          background: transparent;
          color: #888;
          border: 1px solid #333;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .period-button:hover {
          border-color: #00d4ff;
          color: #00d4ff;
        }

        .period-button.active {
          background: #00d4ff;
          color: #000;
          border-color: #00d4ff;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .period-selector {
            flex-wrap: wrap;
            width: 100%;
          }
        }
      `}</style>
    </header>
  );
}

/**
 * Metrics comparison panel
 */
function MetricsPanel({
  rpcUrl,
  period,
}) {
  const {
    summary,
    contributors,
    loading,
    error,
    compareWithPrevious,
  } = useMediaMetrics({
    rpcUrl,
    period,
    autoRefresh: true,
  });

  const comparison = compareWithPrevious();

  if (error) {
    return (
      <div className="metrics-panel error">
        <p>Failed to load metrics: {error}</p>
      </div>
    );
  }

  if (loading || !summary) {
    return (
      <div className="metrics-panel loading">
        <p>Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="metrics-panel">
      <h3>📊 Detailed Metrics</h3>

      <div className="metrics-grid">
        <MetricCard
          title="Sessions Scheduled"
          value={summary.sessionsScheduled}
          change={comparison?.completionChange}
        />
        <MetricCard
          title="Sessions Completed"
          value={summary.sessionsCompleted}
          change={comparison?.completionChange}
        />
        <MetricCard
          title="On-Time %"
          value={summary.onTimePercentage.toFixed(1)}
          change={comparison?.onTimeChange}
          isTrend
        />
        <MetricCard
          title="Assets Created"
          value={summary.totalAssetsCreated}
          change={comparison?.assetChange}
        />
        <MetricCard
          title="Assets Published"
          value={summary.assetsPublished}
        />
        <MetricCard
          title="Total Compensation"
          value={`$${summary.totalCompensationUsd.toFixed(0)}`}
        />
      </div>

      {/* Top Contributors */}
      {contributors && contributors.length > 0 && (
        <div className="contributors-breakdown">
          <h4>Top Contributors This Period</h4>
          <ul className="contributor-list">
            {contributors.slice(0, 5).map((c, idx) => (
              <li key={c.id} className="contributor-row">
                <span className="rank">#{idx + 1}</span>
                <span className="name">{c.name}</span>
                <span className="stats">
                  {c.recordings} recordings • ${c.compensation.toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .metrics-panel {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 24px;
          color: #e0e0e0;
          border: 1px solid #333;
        }

        .metrics-panel.loading,
        .metrics-panel.error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .metrics-panel h3 {
          margin: 0 0 20px 0;
          color: #00d4ff;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .contributors-breakdown {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #333;
        }

        .contributors-breakdown h4 {
          margin: 0 0 12px 0;
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          font-weight: 500;
        }

        .contributor-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }

        .contributor-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
          font-size: 12px;
        }

        .rank {
          color: #00d4ff;
          font-weight: bold;
          min-width: 25px;
        }

        .name {
          color: #fff;
          font-weight: 500;
          flex: 1;
        }

        .stats {
          color: #888;
          font-size: 11px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

/**
 * Metrics card component
 */
function MetricCard({
  title,
  value,
  change,
  isTrend = false,
}) {
  const isPositive = !change || change >= 0;

  return (
    <div className="metric-card">
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      {change !== undefined && (
        <div className={`metric-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}{isTrend ? '%' : ''}
        </div>
      )}

      <style jsx>{`
        .metric-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid #333;
          border-radius: 6px;
          padding: 12px;
        }

        .metric-title {
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }

        .metric-value {
          font-size: 20px;
          font-weight: bold;
          color: #00d4ff;
          margin-bottom: 4px;
        }

        .metric-change {
          font-size: 11px;
          font-weight: 500;
        }

        .metric-change.positive {
          color: #4caf50;
        }

        .metric-change.negative {
          color: #ff6b6b;
        }
      `}</style>
    </div>
  );
}

/**
 * Quick stats sidebar
 */
function QuickStats({ rpcUrl }) {
  const { summary, loading } = useMediaMetrics({
    rpcUrl,
    period: 'week',
    autoRefresh: true,
  });

  if (loading || !summary) {
    return (
      <div className="quick-stats">
        <p>Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="quick-stats">
      <h4>Quick Stats</h4>

      <StatItem
        label="Completion Rate"
        value={(
          (summary.sessionsCompleted / Math.max(summary.sessionsScheduled, 1)) *
          100
        ).toFixed(0)}
        unit="%"
        color="#4caf50"
      />

      <StatItem
        label="On-Time %"
        value={summary.onTimePercentage.toFixed(0)}
        unit="%"
        color="#00d4ff"
      />

      <StatItem
        label="Avg Compensation"
        value="$"
        suffix={(summary.totalCompensationUsd / Math.max(summary.sessionsCompleted, 1)).toFixed(0)}
        color="#ffd700"
      />

      <style jsx>{`
        .quick-stats {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 12px;
          padding: 20px;
          color: #e0e0e0;
          border: 1px solid #333;
        }

        .quick-stats h4 {
          margin: 0 0 16px 0;
          color: #00d4ff;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      `}</style>
    </div>
  );
}

/**
 * Stat item component
 */
function StatItem({
  label,
  value,
  unit,
  suffix,
  color,
}) {
  return (
    <div className="stat-item">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>
        {value}
        {unit && <span>{unit}</span>}
        {suffix && <span className="suffix">{suffix}</span>}
      </div>

      <style jsx>{`
        .stat-item {
          padding: 12px 0;
          border-bottom: 1px solid #333;
        }

        .stat-item:last-child {
          border-bottom: none;
        }

        .stat-label {
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 4px;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: bold;
        }

        .stat-value span {
          font-size: 12px;
          margin-left: 2px;
          color: inherit;
        }

        .suffix {
          font-size: 14px !important;
        }
      `}</style>
    </div>
  );
}
