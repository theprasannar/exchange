import { Fill, Order, OrderBook } from './orderBook';
import { RedisManager } from '../redisManager';
import { ORDER_UPDATE, TRADE_ADDED } from '../types';
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromAPI, ON_RAMP } from '../types/MessageFromAPI';

export const BASE_CURRENCY = "INR";

interface UserBalance {
    [key: string]: {
        available: number;
        locked: number;
    }
}

export class Engine {

    private orderBooks: OrderBook[] = [];
    private balance: Map<String, UserBalance> = new Map();

    constructor() {
        // Initialize only BTC_INR order book
        const btcInrOrderBook = new OrderBook('BTC', [], [], 'INR', 0, 0);
        this.orderBooks.push(btcInrOrderBook);

        // ✅ Seed balances for users
        for (let i = 1; i <= 10; i++) {
            this.balance.set(`user${i}`, {
                INR: { available: 100000000 * i, locked: 0 }, // INR in paisa (for precision)
                BTC: { available: 100000000 * i, locked: 0 }, // BTC in satoshi (for precision)
            });
        }

        // ✅ Pre-seed the order book with initial orders
        this.createOrder("BTC_INR", "50000000", "100000000", "sell", "user1"); // User1 sells 1 BTC @ ₹500000
        this.createOrder("BTC_INR", "51000000", "50000000", "sell", "user2");  // User2 sells 0.5 BTC @ ₹510000

        this.createOrder("BTC_INR", "48000000", "20000000", "buy", "user3");   // User3 buys 0.2 BTC @ ₹480000
        this.createOrder("BTC_INR", "47000000", "40000000", "buy", "user4");   // User4 buys 0.4 BTC @ ₹470000

        console.log("✅ Order book initialized with test orders.");
    }




    process({ message, clientId }: { message: MessageFromAPI, clientId: string }) {
        switch (message.type) {
            case CREATE_ORDER:
                try {
                    const { market, quantity, price, side, userId } = message.data;
                    const { executedQty, fills, orderId } = this.createOrder(market, quantity, price, side, userId)
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_PLACED",
                        payload: {
                            orderId,
                            executedQty,
                            fills
                        }
                    })
                } catch (error) {
                    console.log(error);
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_CANCELLED",
                        payload: {
                            orderId: "",
                            executedQty: 0,
                            remainingQty: 0
                        }
                    });
                }
                break;
            case CANCEL_ORDER: {
                try {
                    const { orderId, market, } = message.data;
                    this.cancelOrder(orderId, market)
                } catch (error) {
                    console.log("Error while cancelling order",);
                    console.log(error);
                }
            }
                break;
            case GET_OPEN_ORDERS:
                try {
                    const { market, userId } = message.data;
                    // Check if a market was provided
                    if (!market || typeof market !== "string") {
                        throw new Error("Market not specified or invalid");
                    }

                    // Check if a userId was provided
                    if (!userId || typeof userId !== "string") {
                        throw new Error("User ID not specified or invalid");
                    }

                    const openOrderbook = this.orderBooks.find(o => o.ticker() === market);
                    if (!openOrderbook) {
                        throw new Error(`No orderbook found for market: ${market}`);
                    }

                    // Get the open orders for the user
                    const openOrders = openOrderbook.getOpenOrders(userId);

                    // Send the open orders back to the client
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "OPEN_ORDERS",
                        payload: openOrders
                    });

                } catch (error) {
                    console.error("Error getting open orders:", error);
                }
                break;
            case ON_RAMP:
                const userId = message.data.userId;
                const amount = Number(message.data.amount);
                this.onRamp(userId, amount);
                break;
            case GET_DEPTH:
                try {
                    const market = message.data.market;

                    if (!market || typeof market !== "string") {
                        throw new Error("Invalid or missing market parameter");
                    }


                    const orderBook = this.orderBooks.find(o => o.ticker() === market)
                    if (!orderBook) {
                        throw new Error(`No OrderBook found for ${market}`);
                    }
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "DEPTH",
                        payload: orderBook.getDepth()
                    });
                } catch (error) {
                    console.log(error);
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "DEPTH",
                        payload: {
                            asks: [],
                            bids: [],
                        }
                    });

                }
        }
    }



    getOrderBookDepth(market: string) {
        const orderBook = this.orderBooks.find(book => book.ticker() === market);
        if (!orderBook) {
            throw new Error(`No OrderBook found for ${market}`);
        }
        return orderBook.getDepth();
    }

    createOrder(market: string, quantity: string, price: string, side: "buy" | "sell", userId: string) {

        //Check if orderBook Exist
        const orderbook = this.orderBooks.find(orderBook => orderBook.ticker() === market);
        if (!orderbook) {
            throw new Error(`No OrderBook found for ${market}`);
        }
        const quantityInt = parseInt(quantity, 10);
        const priceInt = parseInt(price, 10);

        const baseAsset = market.split('_')[0];
        const quoteAssets = market.split('_')[1];

        this.checkAndLockFunds(baseAsset, quoteAssets, userId, priceInt, side, quantityInt);

        //Now we have lock the funds and we can perform operation
        const order: Order = {
            quantity: quantityInt,
            price: priceInt,
            orderId: crypto.randomUUID(),
            filled: 0,
            side,
            userId
        }

        const { fills, executedQty } = orderbook.addOrder(order)
        this.updateBalance(userId, baseAsset, quoteAssets, side, fills);

        this.createDbTrades(fills, market, userId)
        this.updateDbOrders(order, executedQty, fills, market);
        this.publishWsDepthUpdates(fills, price, side, market);
        this.publishWsTrades(fills, userId, market);
        return { executedQty, fills, orderId: order.orderId };


    }
    checkAndLockFunds(baseAsset: string, quoteAsset: string, userId: string, price: number, side: "buy" | "sell", quantity: number) {
        const userBalances = this.balance.get(userId) || {};

        if (side === "buy") {
            // Total cost in paisa = (price per BTC in paisa) * (quantity in satoshis) / 100,000,000
            const totalCost = Math.floor((price * quantity) / 1e8);

            if ((userBalances[quoteAsset]?.available || 0) < totalCost) {
                throw new Error(`Insufficient ${quoteAsset} balance`);
            }

            userBalances[quoteAsset].available -= totalCost;
            userBalances[quoteAsset].locked += totalCost;
        } else {
            if ((userBalances[baseAsset]?.available || 0) < quantity) {
                throw new Error(`Insufficient ${baseAsset} balance`);
            }

            userBalances[baseAsset].available -= quantity;
            userBalances[baseAsset].locked += quantity;
        }
    }

    cancelOrder(orderId: string, market: string) {
        const cancelOrderbook = this.orderBooks.find(o => o.ticker() === market);
        if (!cancelOrderbook) {
            throw new Error("No orderbook found");
        }
        const [baseAsset, quoteAsset] = market.split("_");
        const order = cancelOrderbook.asks.find(o => o.orderId === orderId) || cancelOrderbook.bids.find(o => o.orderId === orderId);
        if (!order) {
            throw new Error("Order not found");
        }
        if (order.side === "buy") {
            let price = cancelOrderbook.cancelBid(order)

            let leftoverLocked = (order.quantity - order.filled) * order.price;

            //@ts-ignore
            this.balance.get(order.userId)[quoteAsset].available += leftoverLocked;

            //@ts-ignore
            this.balance.get(order.userId)[quoteAsset].locked -= leftoverLocked;

            if (price) {
                this.sendUpdatedDepthAt(price.toString(), market)
            }

        }
        if (order.side === "sell") {
            let price = cancelOrderbook.cancelAsk(order)

            let leftoverLocked = (order.quantity - order.filled);

            //@ts-ignore
            this.balance.get(order.userId)[baseAsset].available += leftoverLocked;

            //@ts-ignore
            this.balance.get(order.userId)[baseAsset].locked -= leftoverLocked;

            if (price) {
                this.sendUpdatedDepthAt(price.toString(), market)
            }


        }

        RedisManager.getInstance().sendToApi("ORDER_CANCELED", {
            type: "ORDER_CANCELLED",
            payload: {
                orderId,
                executedQty: order.filled,
                remainingQty: order.quantity - order.filled
            }
        })
    }

    updateBalance(userId: string, baseAsset: string, quoteAsset: string, side: "buy" | "sell", fills: Fill[]) {

        if (side == "buy") {
            fills.forEach((order) => {
                const makerBalances = this.balance.get(order.makerUserId!)!;
                const takerBalances = this.balance.get(userId)!;

                const quoteAmount = Math.floor((order.price * order.quantity) / 1e8);

                // Update maker balance (seller)
                makerBalances[quoteAsset].available += quoteAmount;
                makerBalances[baseAsset].available -= order.quantity;

                // Update taker balance (buyer)
                takerBalances[quoteAsset].locked -= quoteAmount;
                takerBalances[baseAsset].available += order.quantity;
            });
        } else if (side == "sell") {
            fills.forEach(fill => {
                const makerBalances = this.balance.get(fill.makerUserId!)!; // Buyer
                const takerBalances = this.balance.get(userId)!; // Seller
            
                if (side === "sell") {
                  // Calculate the total quote amount (INR) in paisa
                  const quoteAmount = Math.floor((fill.price * fill.quantity) / 1e8); // Convert to paisa
            
                  // Update maker balance (buyer)
                  makerBalances[quoteAsset].locked -= quoteAmount; // Unlock INR
                  makerBalances[baseAsset].available += fill.quantity; // Add BTC
            
                  // Update taker balance (seller)
                  takerBalances[quoteAsset].available += quoteAmount; // Add INR
                  takerBalances[baseAsset].locked -= fill.quantity; // Unlock BTC
                }
              });
        }

    }

    sendUpdatedDepthAt(price: string, market: string) {
        const orderBook = this.orderBooks.find(orderBook => orderBook.ticker() === market)
        if (!orderBook) {
            return;
        }
        const { asks, bids } = orderBook.getDepth();
        const updatedBids = bids.filter(bid => bid[0] === price);
        const updatedAsks = asks.filter(ask => ask[0] === price);

        RedisManager.getInstance().publishMessage(`depth@${market}`, {
            stream: `depth@${market}`,
            data: {
                a: updatedAsks.length ? updatedAsks : [[price, "0"]],
                b: updatedBids.length ? updatedBids : [[price, "0"]],
                e: "depth"
            }
        });

    }

    createDbTrades(fills: Fill[], market: string, userId: string) {
        fills.forEach(fill => {
            // Determine if the buyer is the maker
            const isBuyerMaker = (fill.makerUserId === userId);

            // Log the trade to Redis (or your database)
            RedisManager.getInstance().pushMessage({
                type: TRADE_ADDED, // Message type to indicate a trade occurred
                data: {
                    market,
                    id: fill.tradeId.toString(),
                    isBuyerMaker,
                    price: fill.price,
                    quantity: fill.quantity.toString(),
                    quoteQuantity: (fill.quantity * Number(fill.price)).toString(), // Trade value in quote currency
                    timestamp: Date.now(),           // When the trade occurred
                }
            });
        });
    }

    updateDbOrders(order: Order, executedQty: number, fills: Fill[], market: string) {
        RedisManager.getInstance().pushMessage({
            type: ORDER_UPDATE,
            data: {
                orderId: order.orderId,
                executedQty: executedQty,
                market: market,
                price: order.price,
                quantity: order.quantity.toString(),
                side: order.side,
            }
        });

        fills.forEach(fill => {
            RedisManager.getInstance().pushMessage({
                type: ORDER_UPDATE,
                data: {
                    orderId: fill.makerOrderId!,
                    executedQty: fill.quantity
                }
            });
        });
    }
    publishWsDepthUpdates(fills: Fill[], price: string, side: "buy" | "sell", market: string) {
        const orderbook = this.orderBooks.find(o => o.ticker() === market);
        if (!orderbook) {
            return;
        }
        console.log("Publishing WS Depth Updates for market:", market);

        console.log("Order book found, fetching depth...");

        const depth = orderbook.getDepth();
        console.log("Depth Data:", JSON.stringify(depth));

        if (side === "buy") {
            const updatedAsks = depth?.asks.filter(x => fills.map(f => f.price).includes(x[0].toString()));
            console.log("Updated Asks:", updatedAsks);

            const updatedBid = depth?.bids.find(x => x[0] === price);
            console.log("publish ws depth updates")
            RedisManager.getInstance().publishMessage(`depth@${market}`, {
                stream: `depth@${market}`,
                data: {
                    a: updatedAsks,
                    b: updatedBid ? [updatedBid] : [],
                    e: "depth"
                }
            });
        }
        if (side === "sell") {
            const updatedBids = depth?.bids.filter(x => fills.map(f => f.price).includes(x[0].toString()));
            console.log("Updated Bids:", updatedBids);

            const updatedAsk = depth?.asks.find(x => x[0] === price);
            console.log("publish ws depth updates")
            RedisManager.getInstance().publishMessage(`depth@${market}`, {
                stream: `depth@${market}`,
                data: {
                    a: updatedAsk ? [updatedAsk] : [],
                    b: updatedBids,
                    e: "depth"
                }
            });
        }
    }
    publishWsTrades(fills: Fill[], market: string, userId: string) {
        fills.forEach(fill => {
            const isBuyerMaker = (fill.makerUserId === userId);
            RedisManager.getInstance().publishMessage(`trade@${market}`, {
                stream: `trade@${market}`,
                data: {
                    e: "trade",
                    t: fill.tradeId,
                    m: isBuyerMaker,
                    p: fill.price,
                    q: fill.quantity.toString(),
                    s: market,
                }
            });
        });
    }
    onRamp(userId: string, amount: number) {
        if (amount <= 0) {
            throw new Error('Amount should be grater than 0')
        }
        const userBalance = this.balance.get(userId);
        if (!userBalance) {
            this.balance.set(userId, {
                [BASE_CURRENCY]: {
                    available: amount,
                    locked: 0
                },

            })
        } else {
            userBalance[BASE_CURRENCY].available += amount;
        }

    }

}