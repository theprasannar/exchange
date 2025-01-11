
export interface Order {
    price: number;
    quantity: number;
    side: "buy" | "sell";
    orderId: string;
    filled: number;
    userId: string;
}

export interface Fill {
    price: string;
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
        return `${this.baseAssets}_${this.quoteAssets}`;
    }
    addOrder(order: Order): { executedQty: number, fills: Fill[] } {
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
        const bids: [string, string][] = [];
        const asks: [string, string][] = [];

        //total accumulated bids and asks
        const bidsObj: { [key : string]: number } = {};
        const asksObj: { [key : string]: number } = {};

        //Group by bids
        for(let i=0;i <this.bids.length;i++) {
            if(!bidsObj[this.bids[i].price]) {
                bidsObj[this.bids[i].price] = 0; //bidsObj[100] = 0;
            } 
            bidsObj[this.bids[i].price] += this.bids[i].quantity;
        }

         //Group by asks
         for(let i=0;i <this.asks.length;i++) {
            if(!asksObj[this.asks[i].price]) {
                asksObj[this.asks[i].price] = 0; //asksObj[100] = 0;
            } 
            asksObj[this.asks[i].price] += this.asks[i].quantity;
        }

        //sort the bids in desc
        const sortedBids = Object.keys(bidsObj).sort((a,b)=> Number(b) - Number(a))
        for(const price in sortedBids) {
            bids.push([price, bidsObj[price].toString()]);
        }
        const sortedAsks = Object.keys(bidsObj).sort((a,b)=> Number(a) - Number(b))
        for(const price in sortedAsks) {
            asks.push([price, asksObj[price].toString()]);
        }

        return {asks,bids}
    }

    cancelBid(order : Order) {
        let index = this.bids.findIndex(b=> b.orderId === order.orderId);
        if(index !== 1) {
            const price = this.bids[index].price;
            this.bids.splice(index, 1);
            return price
        }
    }

    cancelAsk(order : Order) {
        let index = this.asks.findIndex(a=> a.orderId === order.orderId);
        if(index !== 1) {
            const price = this.asks[index].price;
            this.bids.splice(index, 1);
            return price
        }
    }

}

