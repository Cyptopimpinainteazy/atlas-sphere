import { useState, useEffect } from 'react';
import { Clock, Rocket } from 'lucide-react';
import { getBlockchainInfo, BlockchainInfo } from '../lib/api';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Fallback launch date if daemon doesn't provide it
const LAUNCH_TIMESTAMP = 1768435200; // January 14, 2026 4:00 PM PST (Jan 15, 00:00 UTC)

export function LaunchCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [chainStarted, setChainStarted] = useState<boolean | null>(null);
  const [launchDate, setLaunchDate] = useState<string>("January 14, 2026 4:00 PM PST");

  useEffect(() => {
    let launchTimestamp = LAUNCH_TIMESTAMP;

    // Fetch launch info from daemon
    const fetchLaunchInfo = async () => {
      try {
        const info: BlockchainInfo = await getBlockchainInfo();
        if (info.chain_started !== undefined) {
          setChainStarted(info.chain_started);
        }
        if (info.chain_start_time) {
          launchTimestamp = info.chain_start_time;
        }
        if (info.chain_start_date) {
          setLaunchDate(info.chain_start_date);
        }
      } catch {
        // Use fallback values
      }
    };

    fetchLaunchInfo();

    // Update countdown every second
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const difference = launchTimestamp - now;

      if (difference <= 0) {
        setChainStarted(true);
        setTimeLeft(null);
      } else {
        setTimeLeft({
          days: Math.floor(difference / 86400),
          hours: Math.floor((difference % 86400) / 3600),
          minutes: Math.floor((difference % 3600) / 60),
          seconds: difference % 60,
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Chain already started
  if (chainStarted === true) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-500/20 border border-accent-500/30">
        <Rocket className="w-4 h-4 text-accent-400" />
        <span className="text-sm font-medium text-accent-400">Mainnet Live!</span>
      </div>
    );
  }

  // Countdown display
  if (timeLeft) {
    return (
      <div className="glass-card px-4 py-3 gradient-border">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-5 h-5 text-primary-400" />
          <span className="text-sm font-semibold text-white">Mainnet Launch</span>
        </div>
        
        <div className="flex items-center gap-3">
          <TimeUnit value={timeLeft.days} label="Days" />
          <Separator />
          <TimeUnit value={timeLeft.hours} label="Hrs" />
          <Separator />
          <TimeUnit value={timeLeft.minutes} label="Min" />
          <Separator />
          <TimeUnit value={timeLeft.seconds} label="Sec" />
        </div>
        
        <p className="text-xs text-surface-400 mt-2">{launchDate}</p>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800/50">
      <Clock className="w-4 h-4 text-surface-400 animate-pulse" />
      <span className="text-sm text-surface-400">Loading...</span>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[40px]">
      <span className="text-xl font-bold text-white font-mono">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] uppercase text-surface-400 tracking-wider">{label}</span>
    </div>
  );
}

function Separator() {
  return <span className="text-surface-500 text-lg font-bold">:</span>;
}

export default LaunchCountdown;

