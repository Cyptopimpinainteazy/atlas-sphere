import React from 'react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: number;
  icon?: React.ReactNode;
  variant?: 'green' | 'blue' | 'purple' | 'orange';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  trend,
  icon,
  variant = 'blue',
}) => {
  const variantClasses = {
    green: 'bg-green-900/20 border-green-700',
    blue: 'bg-blue-900/20 border-blue-700',
    purple: 'bg-purple-900/20 border-purple-700',
    orange: 'bg-orange-900/20 border-orange-700',
  };

  const trendColor = trend && trend >= 0 ? 'text-green-500' : 'text-red-500';
  const trendSymbol = trend && trend >= 0 ? '↑' : '↓';

  return (
    <div className={clsx('bg-slate-800 rounded-lg p-6 border border-slate-700', variantClasses[variant])}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
          <div className="mt-3 flex items-baseline">
            <span className="text-3xl font-bold text-white">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {unit && <span className="text-slate-400 text-sm ml-2">{unit}</span>}
          </div>
          {trend !== undefined && (
            <div className={clsx('mt-2 text-sm font-semibold', trendColor)}>
              {trendSymbol} {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
    </div>
  );
};

interface AlertBoxProps {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  onDismiss?: () => void;
}

export const AlertBox: React.FC<AlertBoxProps> = ({ level, title, message, onDismiss }) => {
  const levelClasses = {
    info: 'bg-blue-900/20 border-blue-700 text-blue-200',
    warning: 'bg-yellow-900/20 border-yellow-700 text-yellow-200',
    critical: 'bg-red-900/20 border-red-700 text-red-200',
  };

  const iconClasses = {
    info: 'text-blue-500',
    warning: 'text-yellow-500',
    critical: 'text-red-500',
  };

  return (
    <div className={clsx('rounded-lg p-4 border', levelClasses[level])}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={clsx('text-xl', iconClasses[level])}>
            {level === 'info' && 'ℹ️'}
            {level === 'warning' && '⚠️'}
            {level === 'critical' && '🔴'}
          </div>
          <div>
            <h4 className="font-semibold">{title}</h4>
            <p className="text-sm opacity-90">{message}</p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-300 transition"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

interface ProgressBarProps {
  value: number; // 0-100
  color?: 'green' | 'blue' | 'orange' | 'red';
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, color = 'blue', label }) => {
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
  };

  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div>
      {label && <label className="text-sm text-slate-400 block mb-2">{label}</label>}
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', colorClasses[color])}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 mt-1 block text-right">{clampedValue.toFixed(0)}%</span>
    </div>
  );
};

interface TabsProps {
  tabs: Array<{ label: string; value: string }>;
  activeTab: string;
  onChangeTab: (value: string) => void;
}

export const Tabs: React.FC<TabsProps & { children: React.ReactNode }> = ({
  tabs,
  activeTab,
  onChangeTab,
  children,
}) => {
  return (
    <div>
      <div className="flex gap-1 border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChangeTab(tab.value)}
            className={clsx(
              'px-4 py-3 text-sm font-medium transition-all border-b-2',
              activeTab === tab.value
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
};
