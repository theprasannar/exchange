import Big from 'big.js';

// Define scales:
export const INR_SCALE = Big(100);            // (if needed)
export const BTC_SCALE = Big(1e8);            // 1 BTC = 100,000,000 satoshis
export const USDC_SCALE = Big(1e6);           // 1 USDC = 1,000,000 microUSDC

// INR conversions (if needed)
export const inrToAtomic = (inr: number | string): bigint => {
  const atomic = Big(inr.toString()).times(INR_SCALE).round(0, 0);
  return BigInt(atomic.toFixed(0));
};
export const atomicToInr = (atomic: bigint): string => {
  return Big(atomic.toString()).div(INR_SCALE).toFixed(2);
};

// BTC conversions
export const btcToAtomic = (btc: number | string): bigint => {
  const atomic = Big(btc.toString()).times(BTC_SCALE).round(0, 0);
  return BigInt(atomic.toFixed(0));
};
export const atomicToBtc = (atomic: bigint): string => {
  return Big(atomic.toString()).div(BTC_SCALE).toFixed(8);
};

// USDC conversions – now that our market is BTC_USDC
export const usdcToAtomic = (usdc: number | string): bigint => {
  const atomic = Big(usdc.toString()).times(USDC_SCALE).round(0, 0);
  return BigInt(atomic.toFixed(0));
};
export const atomicToUsdc = (atomic: bigint): string => {
  return Big(atomic.toString()).div(USDC_SCALE).toFixed(6);
};

// A helper for multiplication/division:
export const mulDiv = (a: bigint, b: bigint, scale: string): bigint => {
  const result = Big(a.toString()).times(b.toString()).div(scale).round(0, 0);
  return BigInt(result.toFixed(0));
};
