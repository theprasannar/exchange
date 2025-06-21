type TradeEntry = {
  price: bigint;
  quantity: bigint;
  timestamp: number;
};

export interface TickerData {
  market: string;
  high: bigint;
  low: bigint;
  last: bigint;
  volume: bigint;
  updatedAt: number;
  createdAt?: number;
  volume24h: bigint;
  high24h: bigint;
  low24h: bigint;
  open24h: bigint;
  change24h: number;
}

class TickerAggregator {
  private tickers: Map<string, TickerData> = new Map();
  private history: Map<string, TradeEntry[]> = new Map();

  updateTicker(
    market: string,
    trade: { price: bigint; quantity: bigint }
  ): void {
    const now = Date.now();
    const existing = this.tickers.get(market);
    if (!existing) {
      this.tickers.set(market, {
        market,
        high: trade.price,
        low: trade.price,
        last: trade.price,
        volume: trade.quantity,
        updatedAt: now,
        volume24h: 0n,
        high24h: trade.price,
        low24h: trade.price,
        open24h: trade.price,
        change24h: 0,
      });
    } else {
      existing.last = trade.price;
      existing.high = trade.price > existing.high ? trade.price : existing.high;
      existing.low = trade.price < existing.low ? trade.price : existing.low;
      existing.volume = existing.volume + trade.quantity;
      existing.updatedAt = now;
      this.tickers.set(market, existing);
    }

    const trades = this.history.get(market) ?? [];
    const cuttOff = now - 24 * 60 * 60 * 1000;
    const prunded = trades.filter((item) => item.timestamp >= cuttOff);

    prunded.push({
      price: trade.price,
      quantity: trade.quantity,
      timestamp: now,
    });

    this.history.set(market, prunded);
  }
  getTicker(market: string): TickerData | null | undefined {
    const base = this.tickers.get(market) || null;
    if (!base) return;

    const trads24h = this.history.get(market) ?? [];
    let volume24h = 0n;
    let high24h = trads24h[0]?.price ?? base.last;
    let low24h = trads24h[0]?.price ?? base.last;
    let open24h = trads24h[0]?.price ?? base.last;

    for (const t of trads24h) {
      volume24h += t.quantity;
      if (t.price > high24h) high24h = t.price;
      if (t.price < low24h) low24h = t.price;
    }

    const change24h =
      open24h > 0n
        ? Number(((base.last - open24h) * 10000n) / open24h) / 100
        : 0;

    return {
      ...base,
      volume24h,
      high24h,
      low24h,
      open24h,
      change24h,
    };
  }
}

export const tickerAggregator = new TickerAggregator();
