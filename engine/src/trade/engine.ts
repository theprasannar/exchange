import { Fill, Order, OrderBook } from './orderBook';
import { RedisManager } from '../redisManager';
import { ORDER_CREATE, ORDER_UPDATE, TRADE_ADDED } from '../types';
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, GET_TICKER_DETAILS, MessageFromAPI, ON_RAMP } from '../types/MessageFromAPI';
import { BTC_SCALE, mulDiv } from '../utils/currency';
import { tickerAggregator } from './tickerAggregator';
import { initRealTimeKlineAggregator } from './realTimeKline';
import prisma from '../../../db/src/lib/prisma';
import { EventStore, Event } from './EventStore';



export const BASE_CURRENCY = "USDC";

interface AssetBalance {
  available: bigint;
  locked: bigint;
}

interface UserBalance {
  [asset: string]: AssetBalance;
}

interface SnapshotData {
  snapshot: string;
  createdAt: Date;
  bids: any[];
  asks: any[];
  lastTradeId: number;
  currentPrice: string;
}

interface OrderbookSnapshot {
  market: string;
  snapshot: string;
  createdAt: Date;
  updatedAt: Date;
}

/**

 * - On startup, loads user balances from the DB.
 * - For any subsequent updates (deposits, orders, trades, orderbook changes):
 *    • Updates the in‑memory state immediately for low latency.
 *    • Publishes an immutable event to a durable event store.
 * - Reconciliation routines compare the in‑memory state with the DB.
 */

export class Engine {
  private orderBooks: OrderBook[] = [];
  private balance: Map<string, UserBalance> = new Map();
  private processedEventIds: Set<string> = new Set(); // For idempotency

  constructor() {
    this.initialize()
  }

  getSupportedMarkers(): Array<{ base: string, quote: string }> {
    return [
      { base: "BTC", quote: BASE_CURRENCY }
    ]
  }
  async initialize() {
    console.log("Engine: Starting recovery process...");

    const supportedMarkets = this.getSupportedMarkers();

    for (const market of supportedMarkets) {
      const orderBook = new OrderBook(market.base, [], [], market.quote, 0, BigInt(0))
      this.orderBooks.push(orderBook);
    }

    //load balance from database
    this.loadAllBalancesFromDB();

    // 3. Recover each orderbook's state.
    await this.recoverState();

    initRealTimeKlineAggregator()
  }

  async loadAllBalancesFromDB() {
    const allUsers = await prisma.user.findMany();
    for (const user of allUsers) {
      this.balance.set(user.id, {
        USDC: { available: BigInt(user.usdcBalance), locked: 0n },
        BTC: { available: BigInt(user.btcBalance), locked: 0n },
      });
    }
    console.log("Engine: Loaded user balances into memory");
  }


  async recoverState() {
    for (const orderBook of this.orderBooks) {
      const market = orderBook.ticker();
      try {
        const snapshotRecord = await prisma.orderbookSnapshot.findUnique({
          where: { market },
        }) as OrderbookSnapshot | null;
        
        if (!snapshotRecord || !snapshotRecord.snapshot) {
          console.log(`Engine: No snapshot found for market ${market}`);
          continue;
        }

        const snapshot = JSON.parse(snapshotRecord.snapshot) as SnapshotData;

        // orderBook.snapshotTime = new Date(snapshotRecord.createdAt).getTime().toString(); 


        orderBook.bids = snapshot.bids.map((order: any) => ({
          ...order,
          price: BigInt(order.price),
          quantity: BigInt(order.quantity),
          filled: BigInt(order.filled),
        }))

        orderBook.asks = snapshot.asks.map((order: any) => ({
          ...order,
          price: BigInt(order.price),
          quantity: BigInt(order.quantity),
          filled: BigInt(order.filled),
        }))

        orderBook.lastTradeId = snapshot.lastTradeId;
        orderBook.currentPrice = BigInt(snapshot.currentPrice);


         // 4) Get the timestamp for replay
      const snapshotTimestamp = snapshotRecord.updatedAt.getTime();

      // Now only replay events with a timestamp strictly greater than snapshotTimestamp
      await this.loadEventsFromRedis(snapshotTimestamp);

        
      } catch (error) {
        console.error(`Engine: Error loading snapshot for market ${market}:`, error);
      }
    }
  }

  async loadEventsFromRedis(snapshotTimestamp: number) {
    try {

      const minScore = snapshotTimestamp ? `(${snapshotTimestamp}` : "0";

      const eventsJson = await RedisManager.getInstance().getZRangeByScore(
        "event_store",
        minScore,
        "+inf"
      );
      const events = eventsJson.map(json => JSON.parse(json));
      events.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`Engine: Replaying ${events.length} events from Redis`);
      for (const event of events) {
        this.applyEvents(event);
      }
    } catch (error) {
      console.log(`Engine: Error loading events from Redis`)
    }
  }

async applyEvents(event: Event) {
  switch (event.type) {
    case ORDER_CREATE: {
      const data = event.data;
      const market = data.market;
      const orderbook = this.orderBooks.find(o => o.ticker() === market);
      if (!orderbook) {
        console.warn(`Engine: Orderbook for market ${market} not found during event replay.`);
        return;
      }
      // Reconstruct the order object from the event data.
      const order = {
        userId: data.userId,
        orderId: data.orderId,
        side: data.side,
        price: BigInt(data.price),
        quantity: BigInt(data.quantity),
        filled: 0n,  // Assume no fills initially
        orderType: data.orderType  // "limit" or "market"
      };
      // Replay by processing the order on the orderbook.
      orderbook.processOrder(order);
      break;
    }
    case ORDER_UPDATE: {
      const data = event.data;
      const market = data.market;
      const orderbook = this.orderBooks.find(o => o.ticker() === market);
      if (!orderbook) {
        console.warn(`Engine: Orderbook for market ${market} not found during ORDER_UPDATE replay.`);
        return;
      }
      // Find the order in bids or asks.
      let order = orderbook.bids.find(o => o.orderId === data.orderId) ||
                  orderbook.asks.find(o => o.orderId === data.orderId);
      if (order) {
        // Update the order's filled quantity.
        order.filled = BigInt(data.executedQty);
      } else {
        console.warn(`Engine: Order ${data.orderId} not found in memory for ORDER_UPDATE replay.`);
      }
      break;
    }
    default:
      console.warn(`Engine: Unknown event type ${event.type} during replay`);
  }
}

  /**
 * onRamp: A user deposits funds.
 *  - Updates the in‑memory balance immediately.
 *  - Publishes a BALANCE_UPDATE event for asynchronous DB persistence.
 */
  async onRamp(userId: string, amount: bigint) {
    if (amount <= 0) {
      throw new Error("Invalid amount for onRamp");
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

    const event: Event = {
      id: this.generateUniqueId(),
      type: "BALANCE_UPDATE",
      data: {
        userId,
        asset: BASE_CURRENCY,
        balance: {
          available: this.balance.get(userId)![BASE_CURRENCY].available.toString()
        },
      },
      timestamp: Date.now()
    }
    await EventStore.publishEvent(event);
  }
  generateUniqueId(): string {
    return crypto.randomUUID();
  }
  async persistBalanceUpdate(userId: string) {
    const userBalance = this.balance.get(userId);
    if (!userBalance) {
      console.error(`No balance found for user ${userId}`);
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        usdcBalance: userBalance.USDC.available,
        btcBalance: userBalance.BTC.available,
      }
    });
  }
  // Engine.ts

  process({ message, clientId }: { message: MessageFromAPI, clientId: string }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const { market, quantity, price, side, userId, orderType } = message.data;
          const { executedQty, fills, orderId } = this.createOrder(market, quantity, price, side, userId, orderType);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty: executedQty.toString(),
              fills: fills.map(fill => ({
                price: fill.price.toString(),
                quantity: fill.quantity.toString(),
                tradeId: fill.tradeId
              }))
            }
          });
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_REJECTED",
            payload: {
              reason: error instanceof Error ? error.message : 'Unknown error occurred'
            }
          });
        }
        break;

      case CANCEL_ORDER:
        try {
          const { orderId, market } = message.data;
          this.cancelOrder(orderId, market, clientId); // Pass clientId to send response
        } catch (error) {
          console.log("Error while cancelling order");
          console.log(error);
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
      case GET_TICKER_DETAILS:
        try {
          const { market } = message.data;

          if (!market) {
            throw new Error("Invalid or missing market parameter");
          }
          const tickerData = tickerAggregator.getTicker(market);
          if (!tickerData) {
            RedisManager.getInstance().sendToApi(clientId, {
              type: "TICKER_UPDATE",
              payload: {
                currentPrice: "0",
                high: "0",
                low: "0",
                volume: "0",
              }
            });
            return
          }
          RedisManager.getInstance().sendToApi(clientId, {
            type: "TICKER_UPDATE",
            //@ts-ignore
            payload: {
              currentPrice: tickerData?.last.toString(),
              high: tickerData?.high.toString(),
              low: tickerData?.low.toString(),
              volume: tickerData?.volume.toString(),
              symbol: market
            }
          })
        } catch (error) {
          console.error("Error fetching ticker data:", error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "TICKER_UPDATE",
            payload: {
              currentPrice: "0",
              high: "0",
              low: "0",
              volume: "0",
            }
          });
        }
    }
  }

  // Engine.ts

  // Replace your createOrder function with this unified version:
  createOrder(
    market: string,
    rawQuantity: string,
    rawPrice: string,
    side: "buy" | "sell",
    userId: string,
    orderType: "limit" | "market"
  ) {
    const orderbook = this.orderBooks.find(ob => ob.ticker() === market);
    if (!orderbook) throw new Error(`No OrderBook found for ${market}`);

    const quantity = BigInt(rawQuantity);
    // For market orders, price is not used; for limit orders, convert rawPrice.
    const price = orderType === "limit" ? BigInt(rawPrice) : 0n;
    const localOrderId = crypto.randomUUID();

    // Publish ORDER_CREATE event (unchanged)
    const orderCreateEvent: Event = {
      id: localOrderId,
      type: ORDER_CREATE,
      data: {
        userId,
        market,
        side,
        price: price.toString(),
        quantity: quantity.toString(),
        orderId: localOrderId,
        orderType,
      },
      timestamp: Date.now(),
    };
    EventStore.publishEvent(orderCreateEvent);

    const [baseAsset, quoteAsset] = market.split("_");

    // Lock funds based on order type:
    if (orderType === "limit") {
      this.checkAndLockFunds(baseAsset, quoteAsset, userId, price, side, quantity);
    } else {
      // For market buy orders, lock all available quote funds.
      if (side === "buy") {
        const userBalances = this.balance.get(userId);
        if (!userBalances) throw new Error(`No balance found for user ${userId}`);
        const maxAvailable = userBalances[quoteAsset].available;
        if (maxAvailable <= 0n) throw new Error(`Insufficient ${quoteAsset} balance`);
        userBalances[quoteAsset].locked += maxAvailable;
        userBalances[quoteAsset].available -= maxAvailable;
      } else {
        // For market sell orders, lock exactly the base asset.
        this.checkAndLockFunds(baseAsset, quoteAsset, userId, 0n, side, quantity);
      }
    }

    // Create the order object including orderType.
    const order: Order = {
      userId,
      orderId: localOrderId,
      side,
      price,
      quantity,
      filled: 0n,
      orderType,
    };

    // Unified processing: call processOrder() on the OrderBook.
    const { executedQty, fills } = orderbook.processOrder(order);

    // Update balances and publish events as before.
    this.updateBalance(userId, baseAsset, quoteAsset, side, fills);
    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publishWsDepthUpdates(fills, price, side, market);
    this.publishWsTrades(fills, market, userId);
    this.updateAndPublishTicker(fills, market);

    return { executedQty, fills, orderId: localOrderId };
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


  updateBalance(userId: string, baseAsset: string, quoteAsset: string, side: "buy" | "sell", fills: Fill[]
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
      const tradeEvent: Event = {
        id: fill.tradeId.toString(),
        type: "TRADE_EXECUTED",
        data: {
          market,
          id: fill.tradeId.toString(),
          isBuyerMaker,
          price: fill.price.toString(),
          quantity: fill.quantity.toString(),
          quoteQuantity: mulDiv(fill.price, fill.quantity, BTC_SCALE.toString()).toString(),
          timestamp: fill.timestamp,
          makerOrderId: fill.makerOrderId || null,
          takerOrderId: null,
          makerUserId: fill.makerUserId || null,
          takerUserId: userId,
        },
        timestamp: Date.now(),
      };
      EventStore.publishEvent(tradeEvent);
    }
  }

  updateDbOrders(order: Order, executedQty: bigint, fills: Fill[], market: string) {
    const orderUpdateEvent: Event = {
      id: this.generateUniqueId(),
      type: "ORDER_UPDATE",
      data: {
        orderId: order.orderId,
        executedQty: executedQty.toString(),
        market,
        price: order.price.toString(),
        quantity: order.quantity.toString(),
        side: order.side,
      },
      timestamp: Date.now(),
    };
    EventStore.publishEvent(orderUpdateEvent);
    for (const fill of fills) {
      const fillUpdateEvent: Event = {
        id: this.generateUniqueId(),
        type: "ORDER_UPDATE",
        data: {
          orderId: fill.makerOrderId!,
          executedQty: fill.quantity.toString(),
        },
        timestamp: Date.now(),
      };
      EventStore.publishEvent(fillUpdateEvent);
    }
  }


  async reconcileBalances() {
    const dbUsers = await prisma.user.findMany();
    for (const user of dbUsers) {
      const memBalance = this.balance.get(user.id);
      if (memBalance) {
        const dbUSDC = BigInt(user.usdcBalance);
        if (memBalance.USDC.available !== dbUSDC) {
          console.error(
            `Reconciliation discrepancy for user ${user.id}: In‑memory USDC ${memBalance.USDC.available} vs DB ${dbUSDC}`
          );
          // Optionally, reissue a balance update event:
          const event: Event = {
            id: this.generateUniqueId(),
            type: "BALANCE_UPDATE",
            data: {
              userId: user.id,
              asset: BASE_CURRENCY,
              available: memBalance.USDC.available.toString(),
            },
            timestamp: Date.now(),
          };
          await EventStore.publishEvent(event);
        }
      } else {
        console.warn(`User ${user.id} missing in memory during reconciliation`);
      }
    }
    console.log("Reconciliation: Completed balance check.");
  }


  async snapshotOrderbook(market: string) {
    const orderbook = this.orderBooks.find(ob => ob.ticker() === market);
    if (!orderbook) {
      console.error(`No orderbook found for market ${market} to snapshot`);
      return;
    }
    const snapshot = orderbook.getSnapshot ? orderbook.getSnapshot() : orderbook;
    const event: Event = {
      id: this.generateUniqueId(),
      type: "ORDERBOOK_SNAPSHOT",
      data: { market, snapshot },
      timestamp: Date.now(),
    };
    await EventStore.publishEvent(event);
  }

  publishWsDepthUpdates(fills: Fill[], price: bigint, side: "buy" | "sell", market: string) {
    const orderbook = this.orderBooks.find((o) => o.ticker() === market);
    if (!orderbook) return;

    const depth = orderbook.getDepth();

    // Convert fill price and array lookups to string for matching
    const priceStr = price.toString();
    if (side === "buy") {
      // which asks were updated?
      const updatedAsks = depth.asks.filter((x) =>
        fills.some((f) => f.price.toString() === x[0])
      );
      const updatedBid = depth.bids.find((x) => x[0] === priceStr);

      // NEW: If there's a fill at `priceStr` but no ask remains => fully removed
      const fillAtPrice = fills.some((f) => f.price.toString() === priceStr);
      const askStillExists = depth.asks.some(([p]) => p === priceStr);
      if (fillAtPrice && !askStillExists) {
        // Push zero-qty row so frontend knows to remove it
        updatedAsks.push([priceStr, "0"]);
      }

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
      const updatedAsk = depth.asks.find((x) => x[0] === priceStr);

      // If there's a fill at `priceStr` but no bid remains => fully removed
      const fillAtPrice = fills.some((f) => f.price.toString() === priceStr);
      const bidStillExists = depth.bids.some(([p]) => p === priceStr);
      if (fillAtPrice && !bidStillExists) {
        updatedBids.push([priceStr, "0"]);
      }

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
          T: fill.timestamp,
        },
      });

      //For Aggregator
      RedisManager.getInstance().publishMessage(`trade_channel`, {
        type: 'TRADE_ADDED',
        data: {
          market: market,
          price: fill.price.toString(),
          quantity: fill.quantity.toString(),
          timestamp: fill.timestamp,
        },
      });
    }
  }

  updateAndPublishTicker(fills: Fill[], market: string,) {
    for (const fill of fills) {
      // Update in-memory ticker aggregator
      tickerAggregator.updateTicker(market, { price: fill.price, quantity: fill.quantity });
      // Retrieve the latest ticker data
      const tickerData = tickerAggregator.getTicker(market);
      if (!tickerData) continue;
      // Publish the ticker update immediately.  
      RedisManager.getInstance().publishMessage(`ticker@${market}`, {
        stream: "ticker",
        data: {
          c: tickerData.last.toString(),
          h: tickerData.high.toString(),
          l: tickerData.low.toString(),
          v: tickerData.volume.toString(),
          s: market,
          id: tickerData.updatedAt, // use updatedAt timestamp
          e: "ticker"
        }
      });
    }

  }
}
