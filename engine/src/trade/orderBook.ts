
export interface Order {
    price: number;
    quantity: number;
    side: "buy" | "sell";
    orderId: string;
    filled: number;
    userId: string;
}

export interface Fill {
    price: number;
    quantity: number;
    tradeId: number;
    makerUserId?: string;
    makerOrderId?: string;

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
        console.log(`${this.baseAssets}_${this.quoteAssets}`)
        return `${this.baseAssets}_${this.quoteAssets}`;
    }
    addOrder(order: Order): { executedQty: number, fills: Fill[] } {
        console.log("Adding order:", order);
    console.log("Before adding, Bids:", JSON.stringify(this.bids));
    console.log("Before adding, Asks:", JSON.stringify(this.asks));
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



    matchBid(order: Order): { fills: Fill[], executedQty: number } {
        let executedQty = 0;
        const fills: Fill[] = [];
        for (let i = 0; i < this.asks.length; i++) {
            if (this.asks[i].price <= order.price && executedQty < order.quantity) {
                const filledQty = Math.min(order.quantity - executedQty, this.asks[i].quantity);
                executedQty += filledQty;

                this.asks[i].filled += filledQty;
                fills.push({
                    price: this.asks[i].price.toString(),
                    quantity: filledQty,
                    tradeId: this.lastTradeId++,
                    makerUserId: this.asks[i].userId,
                    makerOrderId: this.asks[i].orderId
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
    matchAsk(order: Order): { fills: Fill[], executedQty: number } {
        const fills: Fill[] = [];
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
                    makerUserId: this.bids[i].userId,
                    makerOrderId: this.bids[i].orderId
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

    getDepth() {
        console.log("Fetching market depth...");
        console.log("Current Bids before processing:", JSON.stringify(this.bids));
        console.log("Current Asks before processing:", JSON.stringify(this.asks));
    
        const bids: [string, string][] = [];
        const asks: [string, string][] = [];
    
        const bidsObj: { [key: string]: number } = {};
        const asksObj: { [key: string]: number } = {};
    
        for (let i = 0; i < this.bids.length; i++) {
            if (this.bids[i]?.price !== undefined && this.bids[i]?.quantity !== undefined) {
                const priceStr = this.bids[i].price.toString();
                if (!bidsObj[priceStr]) bidsObj[priceStr] = 0;
                bidsObj[priceStr] += this.bids[i].quantity;
            } else {
                console.error("Invalid bid entry:", this.bids[i]);
            }
        }
    
        for (let i = 0; i < this.asks.length; i++) {
            if (this.asks[i]?.price !== undefined && this.asks[i]?.quantity !== undefined) {
                const priceStr = this.asks[i].price.toString();
                if (!asksObj[priceStr]) asksObj[priceStr] = 0;
                asksObj[priceStr] += this.asks[i].quantity;
            } else {
                console.error("Invalid ask entry:", this.asks[i]);
            }
        }
    
        const sortedBids = Object.keys(bidsObj)
            .filter(price => price !== 'undefined')
            .sort((a, b) => Number(b) - Number(a));
    
        for (const price of sortedBids) {
            bids.push([price, bidsObj[price].toString()]);
        }
    
        // Sorting asks in ascending order (lowest price first)
        const sortedAsks = Object.keys(asksObj)
            .filter(price => price !== 'undefined')
            .sort((a, b) => Number(a) - Number(b));
    
        for (const price of sortedAsks) {
            asks.push([price, asksObj[price].toString()]);
        }
    
        console.log("Processed Bids:", JSON.stringify(bids));
        console.log("Processed Asks:", JSON.stringify(asks));
    
        return { asks, bids };
    }
    

    cancelBid(order : Order) {
        let index = this.bids.findIndex(b=> b.orderId === order.orderId);
        if(index !== -1) {
            const price = this.bids[index].price;
            this.bids.splice(index, 1);
            return price
        }
    }

    cancelAsk(order : Order) {
        let index = this.asks.findIndex(a=> a.orderId === order.orderId);
        if(index !== -1) {
            const price = this.asks[index].price;
            this.bids.splice(index, 1);
            return price
        }
    }

        getOpenOrders(userId : string) {
            const asks = this.asks.filter(x => x.userId === userId);
            const bids = this.bids.filter(x => x.userId === userId);
            return [...asks, ...bids]
        }
}

