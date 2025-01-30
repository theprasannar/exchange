// INR: 1 ₹ = 100 paise
export const toPaisa = (inr: number): number => Math.round(inr * 100);
export const toINR = (paisa: number): number => paisa / 100;

// BTC: 1 BTC = 100,000,000 satoshis
export const toSatoshis = (btc: number): number => Math.round(btc * 1e8);
export const toBTC = (sats: number): number => sats / 1e8;