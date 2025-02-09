export interface TickerData {
    market: string
    high: bigint
    low: bigint
    last: bigint
    volume: bigint
    updatedAt: number
}
class TickerAggregator {
    private tickers: Map<string, TickerData> = new Map();

    updateTicker(market: string, trade: {price: bigint, quantity: bigint}) : void {
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
            });
          } else {
            existing.last = trade.price;
            existing.high = trade.price > existing.high ? trade.price : existing.high;
            existing.low = trade.price < existing.low ? trade.price : existing.low;
            existing.volume = existing.volume + trade.quantity;
            existing.updatedAt = now;
            this.tickers.set(market, existing);
          }
    }
    getTicker(market: string): TickerData | null {
        return this.tickers.get(market) || null;
      }
}

export const tickerAggregator = new TickerAggregator();
