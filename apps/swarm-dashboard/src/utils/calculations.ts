// Metric calculations and aggregations
export const calculateAverage = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

export const calculateSum = (values: number[]): number => {
  return values.reduce((a, b) => a + b, 0);
};

export const calculateMin = (values: number[]): number => {
  return Math.min(...values);
};

export const calculateMax = (values: number[]): number => {
  return Math.max(...values);
};

export const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const calculateStdDev = (values: number[]): number => {
  if (values.length === 0) return 0;
  const avg = calculateAverage(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = calculateAverage(squareDiffs);
  return Math.sqrt(avgSquareDiff);
};

export const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

// GPU-specific calculations
export const calculateGpuThermalHealth = (temp: number, maxTemp: number = 85): number => {
  // Returns 0-100 health score based on temperature
  if (temp <= 40) return 100;
  if (temp >= maxTemp) return 0;
  return 100 - ((temp - 40) / (maxTemp - 40)) * 100;
};

export const calculateMemoryHealth = (usedMem: number, totalMem: number): number => {
  // Returns 0-100 health score based on memory usage
  const usage = (usedMem / totalMem) * 100;
  if (usage <= 50) return 100;
  if (usage >= 90) return 0;
  return 100 - ((usage - 50) / 40) * 100;
};

export const estimateTaskDuration = (completedTasks: Array<{ duration: number }>): number => {
  if (completedTasks.length === 0) return 0;
  const durations = completedTasks.map((t) => t.duration);
  return calculateAverage(durations);
};

// Reward calculations
export const calculateRewardRate = (
  totalRewards: number,
  timeWindowHours: number,
  stakeAmount: number
): number => {
  if (timeWindowHours === 0 || stakeAmount === 0) return 0;
  return (totalRewards / (stakeAmount * (timeWindowHours / 24))) * 365 * 100; // APY %
};

export const calculateSlashingRisk = (
  totalSlashed: number,
  totalRewards: number
): number => {
  if (totalRewards === 0) return 0;
  return (totalSlashed / totalRewards) * 100;
};

// Network calculations
export const calculateNetworkHealth = (
  healthyPeers: number,
  totalPeers: number,
  avgLatency: number,
  maxLatency: number = 500
): number => {
  const peerHealth = (healthyPeers / Math.max(totalPeers, 1)) * 100;
  const latencyHealth = Math.max(0, 100 - ((avgLatency / maxLatency) * 100));
  return (peerHealth * 0.6 + latencyHealth * 0.4);
};

export const calculateReputationHealth = (avgReputation: number): number => {
  // Reputation is 0-100, map 70+ as healthy
  return Math.max(0, (avgReputation - 30) / 0.7);
};
