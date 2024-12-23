
export interface Order {
    price: number;
    quantity: number;
    side: "buy" | "sell";
    order_id: string;
    filled: number;
    userId: string;
}

export class OrderBook {
    bids: Order [];
    asks: Order[];
    baseAssets: string;
    quoteAssets: string;
    lastTradeId: number;
    currentPrice: number;

    constructor(baseAssets: string, bids: Order[], asks: Order[], quoteAssets: string, lastTradeId: number, currentPrice: number) {
        this.baseAssets = baseAssets;
        this.bids = bids;
        this.asks = asks;
        this.quoteAssets = quoteAssets;
        this.lastTradeId = lastTradeId;
        this.currentPrice = currentPrice;
    }

    ticker() : string { 
        return `${this.baseAssets}_${this.quoteAssets}`;
    }
    addOrder(order: Order): void {

    }
}

