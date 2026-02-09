// Form validation utilities
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validateAddress = (address: string): boolean => {
  // Basic Ethereum-like address validation
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const validateAmount = (amount: string | number): boolean => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0;
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validatePort = (port: number | string): boolean => {
  const p = typeof port === 'string' ? parseInt(port) : port;
  return p > 0 && p < 65536 && Number.isInteger(p);
};

// Error message formatting
export const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.response?.data?.message) return error.response.data.message;
  return 'An unknown error occurred';
};

// Data validation
export const isValidMetrics = (metrics: any): boolean => {
  return (
    metrics &&
    typeof metrics.tasks_submitted === 'number' &&
    typeof metrics.tasks_completed === 'number' &&
    typeof metrics.gpu_utilization_avg === 'number' &&
    typeof metrics.network_peers === 'number'
  );
};

export const isValidGpuDevice = (device: any): boolean => {
  return (
    device &&
    typeof device.id === 'string' &&
    typeof device.vram === 'number' &&
    typeof device.utilization === 'number' &&
    typeof device.memory_used === 'number'
  );
};

export const isValidTask = (task: any): boolean => {
  return (
    task &&
    typeof task.id === 'string' &&
    ['pending', 'running', 'completed', 'failed'].includes(task.status) &&
    typeof task.reward === 'number'
  );
};

// Status checking
export const isHealthy = (status: string): boolean => {
  return ['healthy', 'online', 'active', 'connected'].includes(status.toLowerCase());
};

export const isWarning = (status: string): boolean => {
  return ['warning', 'degraded', 'slow', 'high_latency'].includes(status.toLowerCase());
};

export const isCritical = (status: string): boolean => {
  return ['critical', 'offline', 'failed', 'error', 'disconnected'].includes(status.toLowerCase());
};
