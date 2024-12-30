
export interface Order {
    price: number;
    quantity: number;
    side: "buy" | "sell";
    orderId: string;
    filled: number;
    userId: string;
}

export interface Fills {
    price: string;
    quantity: number;
    tradeId: number;
    otherUserId?: string;
    markerOrderId?: string;

}
export class OrderBook {
    bids: Order[];
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

    ticker(): string {
        return `${this.baseAssets}_${this.quoteAssets}`;
    }
    addOrder(order: Order): { executedQty: number, fills: Fills[] } {
        if (order.side === "buy") {
            const { executedQty, fills } = this.matchBid(order);
            order.filled = executedQty;

            if (executedQty === order.quantity) {
                // Fully executed, nothing to push
                return { executedQty, fills };
            }

            // Adjust quantity and push the remaining order
            order.quantity = order.quantity - executedQty;
            this.bids.push(order);

            return { executedQty, fills };
        } else if (order.side === "sell") {
            const { executedQty, fills } = this.matchAsk(order);
            order.filled = executedQty;

            if (executedQty === order.quantity) {
                // Fully executed, nothing to push
                return { executedQty, fills };
            }

            // Adjust quantity and push the remaining order
            order.quantity = order.quantity - executedQty;
            this.asks.push(order);

            return { executedQty, fills };
        }

        // Fallback for invalid order.side values
        throw new Error(`Invalid order side: ${order.side}`);
    }



    matchBid(order: Order): { fills: Fills[], executedQty: number } {
        let executedQty = 0;
        const fills: Fills[] = [];
        for (let i = 0; i < this.asks.length; i++) {
            if (this.asks[i].price <= order.price && executedQty < order.quantity) {
                const filledQty = Math.min(order.quantity - executedQty, this.asks[i].quantity);
                executedQty += filledQty;

                this.asks[i].filled += filledQty;
                fills.push({
                    price: this.asks[i].price.toString(),
                    quantity: filledQty,
                    tradeId: this.lastTradeId++,
                    otherUserId: this.asks[i].userId,
                    markerOrderId: this.asks[i].orderId
                });

                // Update the ask
                this.asks[i].quantity -= filledQty;
                if (this.asks[i].quantity === 0) {
                    this.asks.splice(i, 1);
                    i--; // Adjust index after splicing
                }
            }

            if (executedQty >= order.quantity) {
                break;
            }
        }
        return { fills, executedQty };
    }
    matchAsk(order: Order): { fills: Fills[], executedQty: number } {
        const fills: Fills[] = [];
        let executedQty = 0;

        for (let i = 0; i < this.bids.length; i++) {
            if (this.bids[i].price >= order.price && executedQty < order.quantity) {
                const filledQty = Math.min(order.quantity - executedQty, this.bids[i].quantity);
                executedQty += filledQty;

                this.bids[i].filled += filledQty;
                fills.push({
                    price: this.bids[i].price.toString(),
                    quantity: filledQty,
                    tradeId: this.lastTradeId++,
                    otherUserId: this.bids[i].userId,
                    markerOrderId: this.bids[i].orderId
                });

                // Update the bid
                this.bids[i].quantity -= filledQty;
                if (this.bids[i].quantity === 0) {
                    this.bids.splice(i, 1);
                    i--; // Adjust index after splicing
                }
            }

            if (executedQty >= order.quantity) {
                break;
            }
        }

        return { fills, executedQty };
    }

}

