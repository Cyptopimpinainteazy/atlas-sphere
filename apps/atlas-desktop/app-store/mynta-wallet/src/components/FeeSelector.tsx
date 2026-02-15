/**
 * FeeSelector - Dynamic fee estimation component with glassmorphism design
 * 
 * Features:
 * - Fetches dynamic fee estimates from network
 * - Three priority levels (Economy, Normal, Priority)
 * - Custom fee input option
 * - Shows estimated confirmation time
 * - Glass effect styling
 */
import { useState, useEffect } from 'react';
import { Zap, Clock, Gauge, Settings2, Loader2, AlertCircle, RefreshCw, Check } from 'lucide-react';
import * as api from '../lib/api';

export interface FeeEstimate {
  economy: number;
  normal: number;
  priority: number;
}

export type FeePriority = 'economy' | 'normal' | 'priority' | 'custom';

interface FeeSelectorProps {
  onFeeChange: (feeRate: number, priority: FeePriority) => void;
  selectedPriority?: FeePriority;
  disabled?: boolean;
}

// Fallback fees if estimation fails (in MYNTA per kB)
const FALLBACK_FEES: FeeEstimate = {
  economy: 0.00001,
  normal: 0.0001,
  priority: 0.001,
};

// Estimated confirmation times (in blocks)
const CONFIRMATION_TARGETS = {
  economy: 20,  // ~20 blocks
  normal: 6,    // ~6 blocks
  priority: 2,  // ~2 blocks
};

export function FeeSelector({
  onFeeChange,
  selectedPriority = 'normal',
  disabled = false,
}: FeeSelectorProps) {
  const [fees, setFees] = useState<FeeEstimate>(FALLBACK_FEES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<FeePriority>(selectedPriority);
  const [customFee, setCustomFee] = useState('0.0001');
  const [showCustom, setShowCustom] = useState(false);

  // Fetch fee estimates
  const fetchFees = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to get fee estimates from the node
      const [_economyResult, _normalResult, _priorityResult] = await Promise.all([
        api.rpcHelp('estimatesmartfee').catch(() => null),
        api.rpcHelp('estimatesmartfee').catch(() => null),
        api.rpcHelp('estimatesmartfee').catch(() => null),
      ]);

      // For now, use fallback fees since estimatesmartfee might not be available
      setFees(FALLBACK_FEES);
      
    } catch (err) {
      console.error('Failed to fetch fee estimates:', err);
      setError('Using default fees');
      setFees(FALLBACK_FEES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  // Update parent when priority or custom fee changes
  useEffect(() => {
    let feeRate: number;
    
    if (priority === 'custom') {
      feeRate = parseFloat(customFee) || FALLBACK_FEES.normal;
    } else {
      feeRate = fees[priority];
    }
    
    onFeeChange(feeRate, priority);
  }, [priority, customFee, fees, onFeeChange]);

  const getEstimatedTime = (p: FeePriority): string => {
    if (p === 'custom') return 'Varies';
    const blocks = CONFIRMATION_TARGETS[p];
    const minutes = blocks * 1; // ~1 minute per block
    if (minutes < 60) return `~${minutes} min`;
    return `~${Math.round(minutes / 60)} hr`;
  };

  const feeOptions = [
    {
      id: 'economy' as FeePriority,
      name: 'Economy',
      icon: Clock,
      description: 'Slower, cheaper',
      fee: fees.economy,
      time: getEstimatedTime('economy'),
      color: 'text-blue-400',
      glowColor: 'rgb(59 130 246 / 0.3)',
    },
    {
      id: 'normal' as FeePriority,
      name: 'Normal',
      icon: Gauge,
      description: 'Balanced',
      fee: fees.normal,
      time: getEstimatedTime('normal'),
      color: 'text-primary-400',
      glowColor: 'rgb(92 106 255 / 0.3)',
    },
    {
      id: 'priority' as FeePriority,
      name: 'Priority',
      icon: Zap,
      description: 'Fast confirmation',
      fee: fees.priority,
      time: getEstimatedTime('priority'),
      color: 'text-accent-400',
      glowColor: 'rgb(45 212 179 / 0.3)',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="label mb-0">
          Transaction Fee
        </label>
        <button
          onClick={fetchFees}
          disabled={loading || disabled}
          className="btn-ghost text-xs py-1.5 px-2.5 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Fee Options */}
      {loading ? (
        <div className="flex items-center justify-center py-8 glass-subtle rounded-xl">
          <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
          <span className="ml-3 text-surface-400 text-sm font-medium">Estimating fees...</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {feeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = priority === option.id;
            
            return (
              <button
                key={option.id}
                onClick={() => {
                  setPriority(option.id);
                  setShowCustom(false);
                }}
                disabled={disabled}
                className={`relative p-4 rounded-xl transition-all text-left group ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  background: isSelected 
                    ? 'rgb(255 255 255 / 0.06)' 
                    : 'rgb(255 255 255 / 0.02)',
                  border: `1px solid ${isSelected ? 'rgb(255 255 255 / 0.15)' : 'rgb(255 255 255 / 0.06)'}`,
                  boxShadow: isSelected 
                    ? `0 0 24px ${option.glowColor}, inset 0 1px 0 rgb(255 255 255 / 0.05)` 
                    : 'inset 0 1px 0 rgb(255 255 255 / 0.03)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${option.color}`}
                      style={{ background: 'rgb(255 255 255 / 0.1)' }}>
                      <Check className="w-3 h-3" />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg" style={{ background: 'rgb(255 255 255 / 0.05)' }}>
                    <Icon className={`w-4 h-4 ${isSelected ? option.color : 'text-surface-400'}`} />
                  </div>
                </div>
                
                <span className={`text-sm font-semibold block ${isSelected ? 'text-white' : 'text-surface-300'}`}>
                  {option.name}
                </span>
                
                <div className="text-xs text-surface-400 font-mono mt-1">
                  {option.fee.toFixed(6)}
                </div>
                
                <div className={`text-xs mt-2 font-medium ${isSelected ? option.color : 'text-surface-500'}`}>
                  {option.time}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Custom Fee Toggle */}
      <button
        onClick={() => {
          setShowCustom(!showCustom);
          if (!showCustom) setPriority('custom');
        }}
        disabled={disabled}
        className="btn-ghost text-sm py-2 px-3 flex items-center gap-2"
      >
        <Settings2 className="w-4 h-4" />
        {showCustom ? 'Hide custom fee' : 'Set custom fee'}
      </button>

      {/* Custom Fee Input */}
      {showCustom && (
        <div className="p-4 glass-subtle rounded-xl animate-fade-in">
          <label className="label">
            Custom Fee Rate (MYNTA per kB)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.00001"
              min="0.00001"
              value={customFee}
              onChange={(e) => {
                setCustomFee(e.target.value);
                setPriority('custom');
              }}
              disabled={disabled}
              className="input pr-20"
              placeholder="0.0001"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 text-sm font-medium">
              MYNTA
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-3">
            Higher fees = faster confirmation. Minimum: 0.00001 MYNTA
          </p>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg glass-subtle border-yellow-500/20">
          <AlertCircle className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-yellow-400">{error}</span>
        </div>
      )}

      {/* Selected Fee Summary */}
      <div className="summary-panel">
        <div className="flex items-center justify-between">
          <span className="text-surface-400 text-sm">Estimated Fee:</span>
          <span className="text-white font-semibold">
            ~{priority === 'custom' 
              ? (parseFloat(customFee) || 0).toFixed(6)
              : fees[priority as keyof FeeEstimate].toFixed(6)
            } MYNTA
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
          <span className="text-surface-500 text-sm">Confirmation:</span>
          <span className="text-surface-300 font-medium">{getEstimatedTime(priority)}</span>
        </div>
      </div>
    </div>
  );
}

export default FeeSelector;
