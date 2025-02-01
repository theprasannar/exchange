// orderBook.ts

export interface Order {
    price: bigint;       
    quantity: bigint;     
    side: "buy" | "sell";
    orderId: string;
    filled: bigint;      
    userId: string;
}

export interface Fill {
    price: bigint;        
    quantity: bigint;    
    tradeId: number;
    makerUserId?: string;
    makerOrderId?: string;
}

  
// orderBook.ts

export class OrderBook {
    bids: Order[];
    asks: Order[];
    baseAssets: string;
    quoteAssets: string;
    lastTradeId: number;     
    currentPrice: bigint;     

    constructor(
        baseAssets: string,
        bids: Order[],
        asks: Order[],
        quoteAssets: string,
        lastTradeId: number,
        currentPrice: bigint     // Changed from number to bigint
    ) {
        this.baseAssets = baseAssets;
        this.bids = bids;
        this.asks = asks;
        this.quoteAssets = quoteAssets;
        this.lastTradeId = lastTradeId;
        this.currentPrice = currentPrice;
    }
    ticker(): string {
      console.log(`${this.baseAssets}_${this.quoteAssets}`);
      return `${this.baseAssets}_${this.quoteAssets}`;
    }
  
    /**
     * Adds an order into the orderbook, tries to match it.
     * Returns { executedQty: bigint, fills: Fill[] }.
     */
// orderBook.ts

addOrder(order: Order): { executedQty: bigint; fills: Fill[] } {

    let executedQty: bigint;
    let fills: Fill[];

    if (order.side === "buy") {
        ({ executedQty, fills } = this.matchBid(order));
        // Update how much this order has been filled:
        order.filled = order.filled + executedQty;

        // If fully filled, do not push to bids
        if (order.filled === order.quantity) {
            return { executedQty, fills };
        }

        // Otherwise, reduce quantity by what was executed
        order.quantity = order.quantity - executedQty;
        this.bids.push(order);
        return { executedQty, fills };
    } else if (order.side === "sell") {
        ({ executedQty, fills } = this.matchAsk(order));
        order.filled = order.filled + executedQty;

        if (order.filled === order.quantity) {
            return { executedQty, fills };
        }

        order.quantity = order.quantity - executedQty;
        this.asks.push(order);
        return { executedQty, fills };
    }

    // Fallback for invalid side
    throw new Error(`Invalid order side: ${order.side}`);
}

  
    /**
     * matchBid tries to fill a BUY order against existing asks
     */// orderBook.ts

private matchBid(order: Order): { fills: Fill[]; executedQty: bigint } {
    let executedQty: bigint = 0n;
    const fills: Fill[] = [];

    for (let i = 0; i < this.asks.length; i++) {
        // Price check & quantity check
        if (this.asks[i].price <= order.price && executedQty < order.quantity) {
            // How much is left to fill on this BUY?
            const remaining = order.quantity - executedQty;
            // How much is left in this ask?
            const availableAskQty = this.asks[i].quantity - this.asks[i].filled;

            const fillableQty = remaining < availableAskQty ? remaining : availableAskQty;

            if (fillableQty > 0n) {
                // Increase executedQty
                executedQty += fillableQty;

                // Increase the ask's filled quantity
                this.asks[i].filled += fillableQty;

                fills.push({
                    price: this.asks[i].price,                // Changed to bigint
                    quantity: fillableQty,                    // bigint
                    tradeId: this.lastTradeId++,
                    makerUserId: this.asks[i].userId,
                    makerOrderId: this.asks[i].orderId,
                });

                // If that ask is fully filled, remove it
                if (this.asks[i].filled === this.asks[i].quantity) {
                    this.asks.splice(i, 1);
                    i--; // Adjust loop index after removal
                }
            }
        }

        // If we've matched the entire buy order, break
        if (executedQty >= order.quantity) {
            break;
        }
    }

    return { fills, executedQty };
}

private matchAsk(order: Order): { fills: Fill[]; executedQty: bigint } {
    let executedQty: bigint = 0n;
    const fills: Fill[] = [];

    for (let i = 0; i < this.bids.length; i++) {
        if (this.bids[i].price >= order.price && executedQty < order.quantity) {
            // How much is left to fill on this SELL?
            const remaining = order.quantity - executedQty;
            // How much is left in this bid?
            const availableBidQty = this.bids[i].quantity - this.bids[i].filled;

            const fillableQty = remaining < availableBidQty ? remaining : availableBidQty;

            if (fillableQty > 0n) {
                executedQty += fillableQty;
                this.bids[i].filled += fillableQty;

                fills.push({
                    price: this.bids[i].price,                // Changed to bigint
                    quantity: fillableQty,                    // bigint
                    tradeId: this.lastTradeId++,
                    makerUserId: this.bids[i].userId,
                    makerOrderId: this.bids[i].orderId,
                });

                // If that bid is fully filled, remove it
                if (this.bids[i].filled === this.bids[i].quantity) {
                    this.bids.splice(i, 1);
                    i--;
                }
            }
        }

        if (executedQty >= order.quantity) {
            break;
        }
    }

    return { fills, executedQty };
}


 // orderBook.ts

 public getDepth(): { bids: [string, string][]; asks: [string, string][]; } {
    const bidsObj: { [price: string]: bigint } = {};
    const asksObj: { [price: string]: bigint } = {};

    // Aggregate open quantities for bids
    for (let i = 0; i < this.bids.length; i++) {
        const priceStr = this.bids[i].price.toString();
        const openQty = this.bids[i].quantity - this.bids[i].filled;
        if (!bidsObj[priceStr]) {
            bidsObj[priceStr] = openQty;
        } else {
            bidsObj[priceStr] += openQty;
        }
    }

    // Aggregate open quantities for asks
    for (let i = 0; i < this.asks.length; i++) {
        const priceStr = this.asks[i].price.toString();
        const openQty = this.asks[i].quantity - this.asks[i].filled;
        if (!asksObj[priceStr]) {
            asksObj[priceStr] = openQty;
        } else {
            asksObj[priceStr] += openQty;
        }
    }

    // Sort bids descending
    const sortedBids = Object.keys(bidsObj)
        .filter(price => price !== "undefined")
        .sort((a, b) => BigInt(b) > BigInt(a) ? 1 : -1);

    const bids: [string, string][] = sortedBids.map(price => [
        price,
        bidsObj[price].toString()
    ]);

    // Sort asks ascending
    const sortedAsks = Object.keys(asksObj)
        .filter(price => price !== "undefined")
        .sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);

    const asks: [string, string][] = sortedAsks.map(price => [
        price,
        asksObj[price].toString()
    ]);

    return { bids, asks };

}

  
    cancelBid(order: Order) {
      const index = this.bids.findIndex((b) => b.orderId === order.orderId);
      if (index !== -1) {
        const price = this.bids[index].price;
        this.bids.splice(index, 1);
        return price;
      }
    }
  
    cancelAsk(order: Order) {
      const index = this.asks.findIndex((a) => a.orderId === order.orderId);
      if (index !== -1) {
        const price = this.asks[index].price;
        this.asks.splice(index, 1);
        return price;
      }
    }
  
    getOpenOrders(userId: string) {
      const asks = this.asks.filter((x) => x.userId === userId);
      const bids = this.bids.filter((x) => x.userId === userId);
      return [...asks, ...bids];
    }
  }
  