import { Fill, Order, OrderBook } from './orderBook';
import { RedisManager } from '../redisManager';
import { TRADE_ADDED } from '../types';
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
        const btcInrOrderBook = new OrderBook('BTC', [], [], 'INR', 0, 0);
        this.orderBooks.push(btcInrOrderBook);

        // Initialize balances
        this.balance.set('user1', {
            INR: { available: 5000000, locked: 0 },
            BTC: { available: 0, locked: 0 },
        });

        this.balance.set('user2', {
            INR: { available: 0, locked: 0 },
            BTC: { available: 5, locked: 0 },
        });

        // Add a sell order from user2
        btcInrOrderBook.addOrder({
            price: 100, // Selling 1 BTC for 3,000,000 INR
            quantity: 100,
            side: 'sell',
            orderId: 'order2',
            filled: 0,
            userId: 'user2',
        });
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

    getUserBalances() {
        console.log('User1 Balance:', this.balance.get('user1'));
        console.log('User2 Balance:', this.balance.get('user2'));
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
        const baseAsset = market.split('_')[0];
        const quoteAssets = market.split('_')[1];

        this.checkAndLockFunds(baseAsset, quoteAssets, userId, price, side, quantity);

        //Now we have lock the funds and we can perform operation
        const order: Order = {
            price: Number(price),
            quantity: Number(quantity),
            orderId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            filled: 0,
            side,
            userId
        }

        const { fills, executedQty } = orderbook.addOrder(order)
        this.updateBalance(userId, baseAsset, quoteAssets, side, fills, executedQty);
        this.createDbTrades(fills, market, userId)
        return { executedQty, fills, orderId: order.orderId };


    }
    checkAndLockFunds(baseAsset: string, quoteAssets: string, userId: string, price: string, side: "buy" | "sell", quantity: string) {
        if (side === "buy") {
            const userBalance = this.balance.get(userId)?.[quoteAssets]?.available || 0;
            if (userBalance < Number(price) * Number(quantity)) {
                throw new Error(`Insufficient balance for ${quoteAssets}`);
            }
            // Lock the funds
            this.balance.get(userId)![quoteAssets].available -= Number(price) * Number(quantity);
            this.balance.get(userId)![quoteAssets].locked += Number(price) * Number(quantity);
        } else {
            const userBalance = this.balance.get(userId)?.[baseAsset]?.available || 0;
            if (userBalance < Number(quantity)) {
                throw new Error(`Insufficient funds`);
            }
            // Lock the funds
            this.balance.get(userId)![baseAsset].available -= Number(quantity);
            this.balance.get(userId)![baseAsset].locked += Number(quantity);
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

    updateBalance(userId: string, baseAsset: string, quoteAsset: string, side: "buy" | "sell", fills: Fill[], executedQty: number) {

        if (side == "buy") {
            fills.forEach((order) => {
                //@ts-ignore
                this.balance.get(order.makerUserId)?.[quoteAsset]?.available = this.balance.get(order.makerUserId)?.[quoteAsset]?.available + order.amount * order.quantity;

                //@ts-ignore
                this.balance.get(userId)?.[quoteAsset]?.available = this.balance.get(userId)?.[quoteAsset]?.available - order.amount * order.quantity;

                //@ts-ignore
                this.balance.get(order.makerUserId)?.[baseAsset]?.available = this.balance.get(order.makerUserId)?.[baseAsset]?.available - order.quantity;

                //@ts-ignore
                this.balance.get(userId)?.[baseAsset]?.available = this.balance.get(userId)?.[baseAsset]?.available + order.quantity;
            });
        } else if (side == "sell") {
            fills.forEach((order) => {
                //@ts-ignore
                this.balance.get(order.makerUserId)?.[baseAsset]?.available = this.balance.get(order.makerUserId)?.[baseAsset]?.available + order.quantity;

                //@ts-ignore
                this.balance.get(userId)?.[baseAsset]?.available = this.balance.get(userId)?.[baseAsset]?.available - order.quantity;

                //@ts-ignore
                this.balance.get(order.makerUserId)?.[quoteAsset]?.available = this.balance.get(order.makerUserId)?.[quoteAsset]?.available - order.amount * order.quantity;

                //@ts-ignore
                this.balance.get(userId)?.[quoteAsset]?.available = this.balance.get(userId)?.[quoteAsset]?.available + order.amount * order.quantity;
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