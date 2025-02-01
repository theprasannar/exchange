import { Fill, Order, OrderBook } from './orderBook';
import { RedisManager } from '../redisManager';
import { ORDER_UPDATE, TRADE_ADDED } from '../types';
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, MessageFromAPI, ON_RAMP } from '../types/MessageFromAPI';
import { BTC_SCALE, mulDiv } from '../utils/currency';

export const BASE_CURRENCY = "USDC";

interface UserBalance {
  [key: string]: {
    available: bigint;
    locked: bigint;
  };
}

export class Engine {
  private orderBooks: OrderBook[] = [];
  private balance: Map<string, UserBalance> = new Map();

 // Engine.ts

constructor() {
    const btcInrOrderBook = new OrderBook('BTC', [], [], 'USDC', 0, 0n);
    this.orderBooks.push(btcInrOrderBook);

    // // Pre-seed user balances
    for (let i = 1; i <= 11; i++) {
        this.balance.set(`user${i}`, {
            USDC: { available: 100000000n * BigInt(i), locked: 0n },    // Use bigint literals
            BTC: {available: 100000000n * BigInt(i),  locked: 0n },
        });
    }

    // // Create initial orders
    // this.createOrder("BTC_USDC", "50000000", "100000000", "sell", "user1"); // 1 BTC @ ₹500000
    // this.createOrder("BTC_USDC", "51000000", "50000000", "sell", "user2");
    // this.createOrder("BTC_USDC", "48000000", "20000000", "buy", "user3");
    // this.createOrder("BTC_USDC", "47000000", "40000000", "buy", "user4");
}

// Engine.ts

process({ message, clientId }: { message: MessageFromAPI, clientId: string }) {
    switch (message.type) {
        case CREATE_ORDER:
            try {
                const { market, quantity, price, side, userId } = message.data;
                const { executedQty, fills, orderId } = this.createOrder(market, quantity, price, side, userId);
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "ORDER_PLACED",
                    payload: {
                        orderId,
                        executedQty: executedQty.toString(),    // Convert bigint to string
                        fills: fills.map(fill => ({
                            price: fill.price.toString(),       // Convert bigint to string
                            quantity: fill.quantity.toString(), // Convert bigint to string
                            tradeId: fill.tradeId
                        }))
                    }
                });
            } catch (error) {
                console.log(error);
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "ORDER_CANCELLED",
                    payload: {
                        orderId: "",
                        executedQty: "0",
                        remainingQty: "0"
                    }
                });
            }
            break;

        case CANCEL_ORDER: {
            try {
                const { orderId, market } = message.data;
                this.cancelOrder(orderId, market, clientId); // Pass clientId to send response
            } catch (error) {
                console.log("Error while cancelling order");
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

                // Convert openOrders to strings for JSON
                const payload = openOrders.map(order => ({
                    orderId: order.orderId,
                    filled: order.filled.toString(),
                    price: order.price.toString(),
                    quantity: order.quantity.toString(),
                    side: order.side,
                    userId: order.userId
                }));

                // Send the open orders back to the client
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "OPEN_ORDERS",
                    payload: payload
                });

            } catch (error) {
                console.error("Error getting open orders:", error);
            }
            break;

        case ON_RAMP:
            try {
                const userId = message.data.userId;
                const amount = BigInt(message.data.amount); // Convert string to bigint
                this.onRamp(userId, amount);
            } catch (error) {
                console.error("Error in onRamp:", error);
            }
            break;

        case GET_DEPTH:
            try {
                const market = message.data.market;

                if (!market || typeof market !== "string") {
                    throw new Error("Invalid or missing market parameter");
                }

                const orderBook = this.orderBooks.find(o => o.ticker() === market);
                if (!orderBook) {
                    throw new Error(`No OrderBook found for market: ${market}`);
                }
                const depth = orderBook.getDepth();
                RedisManager.getInstance().sendToApi(clientId, {
                  type: "DEPTH",
                  payload: depth
              });

            } catch (error) {
                console.log(error);
                RedisManager.getInstance().sendToApi(clientId, {
                    type: "DEPTH",
                    payload: {
                        bids: [],
                        asks: [],
                    }
                });
            }
            break;
    }
}

// Engine.ts

createOrder(market: string, rawQuantity: string, rawPrice: string, side: "buy" | "sell", userId: string) {
    // Check if orderBook exists
    const orderbook = this.orderBooks.find(orderBook => orderBook.ticker() === market);
    if (!orderbook) {
        throw new Error(`No OrderBook found for ${market}`);
    }

    const quantity = BigInt(rawQuantity);  // Convert directly to bigint
    const price = BigInt(rawPrice);        // Convert directly to bigint

    const baseAsset = market.split('_')[0];
    const quoteAsset = market.split('_')[1];

    this.checkAndLockFunds(baseAsset, quoteAsset, userId, price, side, quantity);

    // Now we have locked the funds and can perform operation
    const order: Order = {
        quantity: quantity,
        price: price,
        orderId: crypto.randomUUID(),
        filled: 0n,
        side,
        userId
    }

    const { fills, executedQty } = orderbook.addOrder(order);
    this.updateBalance(userId, baseAsset, quoteAsset, side, fills);

    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publishWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, market, userId);
    return { executedQty, fills, orderId: order.orderId };
}


  checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    userId: string,
    price: bigint, //price in atomic
    side: "buy" | "sell",
    quantity: bigint //quantity in atomic
  ) {
    const userBalances = this.balance.get(userId);
    if (!userBalances) {
      throw new Error(`No balance found for user ${userId}`);
    }

    if (side === "buy") {
      const totalCost = mulDiv(price, quantity, BTC_SCALE.toString());
      if (userBalances[quoteAsset].available < totalCost) {
        throw new Error(`Insufficient ${quoteAsset} balance`);
      }
      userBalances[quoteAsset].available = userBalances[quoteAsset].available - totalCost;
      userBalances[quoteAsset].locked = userBalances[quoteAsset].locked + totalCost;
    } else {
      if (userBalances[baseAsset].available < quantity) {
        throw new Error(`Insufficient ${baseAsset} balance`);
      }
      userBalances[baseAsset].available = userBalances[baseAsset].available - quantity;
      userBalances[baseAsset].locked = userBalances[baseAsset].locked + quantity;
    }
  }

 // Engine.ts

cancelOrder(orderId: string, market: string, clientId: string) {
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
        const price = cancelOrderbook.cancelBid(order);
        if (!price) throw new Error("Order price not found");

        const leftoverLocked = (order.quantity - order.filled) * order.price;

        const userBalances = this.balance.get(order.userId);
        if (!userBalances) throw new Error(`User ${order.userId} not found`);

        userBalances[quoteAsset].available += leftoverLocked;
        userBalances[quoteAsset].locked -= leftoverLocked;

        this.sendUpdatedDepthAt(price.toString(), market);
    }

    if (order.side === "sell") {
        const price = cancelOrderbook.cancelAsk(order);
        if (!price) throw new Error("Order price not found");

        const leftoverLocked = order.quantity - order.filled;

        const userBalances = this.balance.get(order.userId);
        if (!userBalances) throw new Error(`User ${order.userId} not found`);

        userBalances[baseAsset].available += leftoverLocked;
        userBalances[baseAsset].locked -= leftoverLocked;

        this.sendUpdatedDepthAt(price.toString(), market);
    }

    // Send ORDER_CANCELLED message to client
    RedisManager.getInstance().sendToApi(clientId, {
        type: "ORDER_CANCELLED",
        payload: {
            orderId,
            executedQty: order.filled.toString(),
            remainingQty: (order.quantity - order.filled).toString()
        }
    });
}


  updateBalance( userId: string, baseAsset: string,quoteAsset: string,side: "buy" | "sell",fills: Fill[]
  ) {
    const takerBalances = this.balance.get(userId);
    if (!takerBalances) return;

    if (side === "buy") {
      // Taker is the buyer
      for (const fill of fills) {
        const makerBalances = this.balance.get(fill.makerUserId!);
        if (!makerBalances) continue;

        // Convert fill's price*qty to a BigInt cost
        const quoteAmount = mulDiv(fill.price, fill.quantity, BTC_SCALE.toString());

        // Maker = seller
        makerBalances[quoteAsset].available = makerBalances[quoteAsset].available + quoteAmount;
        makerBalances[baseAsset].available = makerBalances[baseAsset].available - fill.quantity;

        // Taker = buyer
        takerBalances[quoteAsset].locked = takerBalances[quoteAsset].locked - quoteAmount;
        takerBalances[baseAsset].available = takerBalances[baseAsset].available + fill.quantity;
      }
    } else {
      // Taker is the seller
      for (const fill of fills) {
        const makerBalances = this.balance.get(fill.makerUserId!);
        if (!makerBalances) continue;

        // Buyer locked some quote
        const quoteAmount = mulDiv(fill.price, fill.quantity, BTC_SCALE.toString());

        // Maker = buyer
        makerBalances[quoteAsset].locked = makerBalances[quoteAsset].locked - quoteAmount;
        makerBalances[baseAsset].available = makerBalances[baseAsset].available + fill.quantity;

        // Taker = seller
        takerBalances[quoteAsset].available = takerBalances[quoteAsset].available + quoteAmount;
        takerBalances[baseAsset].locked = takerBalances[baseAsset].locked - fill.quantity;
      }
    }
  }

  sendUpdatedDepthAt(price: string, market: string) {
    const orderBook = this.orderBooks.find((o) => o.ticker() === market);
    if (!orderBook) return;
    const { asks, bids } = orderBook.getDepth();
    const updatedBids = bids.filter((bid) => bid[0] === price);
    const updatedAsks = asks.filter((ask) => ask[0] === price);

    RedisManager.getInstance().publishMessage(`depth@${market}`, {
      stream: `depth@${market}`,
      data: {
        a: updatedAsks.length ? updatedAsks : [[price, "0"]],
        b: updatedBids.length ? updatedBids : [[price, "0"]],
        e: "depth",
      },
    });
  }

  createDbTrades(fills: Fill[], market: string, userId: string) {
    for (const fill of fills) {
      const isBuyerMaker = fill.makerUserId === userId;

      RedisManager.getInstance().pushMessage({
        type: TRADE_ADDED,
        data: {
          market,
          id: fill.tradeId.toString(),
          isBuyerMaker,
          price: fill.price.toString(),
          quantity: fill.quantity.toString(),
          quoteQuantity: mulDiv(fill.price, fill.quantity, BTC_SCALE.toString()).toString(),
          timestamp: Date.now(),
        },
      });
    }
  }

  updateDbOrders(order: Order, executedQty: bigint, fills: Fill[], market: string) {
    RedisManager.getInstance().pushMessage({
      type: ORDER_UPDATE,
      data: {
        orderId: order.orderId,
        executedQty: executedQty.toString(),
        market: market,
        price: order.price.toString(),
        quantity: order.quantity.toString(),
        side: order.side,
      },
    });

    for (const fill of fills) {
      RedisManager.getInstance().pushMessage({
        type: ORDER_UPDATE,
        data: {
          orderId: fill.makerOrderId!,
          executedQty: fill.quantity.toString(),
        },
      });
    }
  }

  publishWsDepthUpdates(fills: Fill[], price: bigint, side: "buy" | "sell", market: string) {
    const orderbook = this.orderBooks.find((o) => o.ticker() === market);
    if (!orderbook) return;

    const depth = orderbook.getDepth();
    if (side === "buy") {
      // which asks were updated?
      const updatedAsks = depth.asks.filter((x) =>
        fills.some((f) => f.price.toString() === x[0])
      );
      const updatedBid = depth.bids.find((x) => x[0] === price.toString());

      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsks,
          b: updatedBid ? [updatedBid] : [],
          e: "depth",
        },
      });
    } else {
      // side === "sell"
      const updatedBids = depth.bids.filter((x) =>
        fills.some((f) => f.price.toString() === x[0])
      );
      const updatedAsk = depth.asks.find((x) => x[0] === price.toString());

      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsk ? [updatedAsk] : [],
          b: updatedBids,
          e: "depth",
        },
      });
    }
  }

  publishWsTrades(fills: Fill[], market: string, userId: string) {
    for (const fill of fills) {
      const isBuyerMaker = fill.makerUserId === userId;
      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: isBuyerMaker,
          p: fill.price.toString(),      // Convert BigInt -> string
          q: fill.quantity.toString(),
          s: market,
        },
      });
    }
  }

  onRamp(userId: string, amount: bigint) {
    if (amount <= 0) {
      throw new Error("Amount should be greater than 0");
    }
    const userBalance = this.balance.get(userId);
    if (!userBalance) {
      this.balance.set(userId, {
        [BASE_CURRENCY]: {
          available: BigInt(amount), // store as bigint
          locked: 0n,
        },
      });
    } else {
      userBalance[BASE_CURRENCY].available = userBalance[BASE_CURRENCY].available + BigInt(amount);
    }
  }
}
