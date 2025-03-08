export interface KLine {
    market: string;
    interval: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    trades: number;      // or string
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
    bids: [string, string][],
    asks: [string, string][],
    lastUpdateId: string
}

export interface Ticker {
    "firstPrice": string,
    "high": string,
    "lastPrice": string,
    "low": string,
    "priceChange": string,
    "priceChangePercent": string,
    "quoteVolume": string,
    "symbol": string,
    "trades": string,
    "volume": string
}

export interface TickerFromEngine {
    currentPrice: string,
    high: string,
    low: string,
    volume: string,
    symbol: string,
}
export interface Candle {
    market?: string;
    interval?: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    trades: number;      // or string
    startTime: number;
    endTime: number;
}
