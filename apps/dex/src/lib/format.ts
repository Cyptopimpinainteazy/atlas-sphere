import Decimal from 'decimal.js';

/**
 * Format a raw amount with decimals to a human-readable string.
 */
export function formatAmount(
  amount: string | number | bigint,
  decimals: number = 18,
  maxDecimals: number = 6
): string {
  if (!amount) return '0';
  
  const value = new Decimal(amount.toString())
    .div(new Decimal(10).pow(decimals));
  
  if (value.isZero()) return '0';
  if (value.lt(0.000001)) return '<0.000001';
  
  return value.toFixed(Math.min(maxDecimals, decimals), Decimal.ROUND_DOWN);
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US');
}

/**
 * Format a USD value.
 */
export function formatUsd(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a percentage.
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Shorten an address for display.
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Parse a human-readable amount to raw units.
 */
export function parseAmount(amount: string, decimals: number = 18): string {
  if (!amount) return '0';
  
  const value = new Decimal(amount)
    .mul(new Decimal(10).pow(decimals))
    .floor();
  
  return value.toString();
}
