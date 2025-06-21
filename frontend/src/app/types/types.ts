export interface KLine {
  market: string;
  interval: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number; // or string
  startTime: number;
  endTime: number;
}

export type Trade = {
  id?: number;
  isBuyerMaker: boolean;
  price: string;
  quantity: string;
  quoteQuantity?: string;
  symbol?: string;
  timestamp: string;
};

export interface Depth {
  bids: [string, string][];
  asks: [string, string][];
  lastUpdateId: string;
}

export interface Ticker {
  firstPrice: string;
  high: string;
  lastPrice: string;
  low: string;
  priceChange: string;
  priceChangePercent: string;
  quoteVolume: string;
  symbol: string;
  trades: string;
  volume: string;
}

export interface TickerFromEngine {
  currentPrice: string;
  high: string;
  low: string;
  volume: string;
  symbol: string;
  createdAt?: number;
  volume24h: string;
  high24h: string;
  low24h: string;
  open24h: string;
  change24h: string;
}
export interface Candle {
  market?: string;
  interval?: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  trades: number; // or string
  startTime: number;
  endTime: number;
}

export interface Order {
  orderId: string;
  side: "buy" | "sell";
  price: string; // atomic price (e.g. "50000000")
  quantity: string; // atomic qty
  filled: string;
  status: "PENDING" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
  createdAt: string; // ISO timestamp
}

export interface Balance {
  USDC: {
    available: string;
    locked: string;
  };
  BTC: {
    available: string;
    locked: string;
  };
}
