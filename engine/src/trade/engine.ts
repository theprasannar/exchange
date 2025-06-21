import { Fill, Order, OrderBook } from "./orderBook";
import { RedisManager } from "../redisManager";
import { ORDER_CREATE, ORDER_UPDATE, TRADE_ADDED } from "../types";
import {
  CANCEL_ORDER,
  CREATE_ORDER,
  GET_DEPTH,
  GET_OPEN_ORDERS,
  GET_TICKER_DETAILS,
  MessageFromAPI,
  ON_RAMP,
  GET_USER_BALANCE,
  SYNC_USER_BALANCE,
} from "../types/MessageFromAPI";
import { BTC_SCALE, mulDiv } from "../utils/currency";
import { tickerAggregator } from "./tickerAggregator";
import { initRealTimeKlineAggregator } from "./realTimeKline";
import prisma from "../../../db/src/lib/prisma";
import { EventStore, Event } from "./EventStore";

// Just to avoid TS errors about crypto:
import crypto from "crypto"; // Make sure you import or require 'crypto' if you're in Node

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
 * Engine responsibilities:
 * 1) Load user balances from DB on startup
 * 2) Maintain the in-memory state of balances and orderbooks
 * 3) Publish events for each change
 * 4) Listen to events from Redis to replay or recover state
 * 5) Periodically snapshot orderbooks
 * 6) Reconcile balances with DB
 */
export class Engine {
  private orderBooks: OrderBook[] = [];
  private balance: Map<string, UserBalance> = new Map();
  private processedEventIds: Set<string> = new Set(); // For idempotency

  constructor() {
    this.initialize();
    // this.setupPeriodicTasks();
  }

  /**
   * This function sets up periodic tasks to snapshot orderbooks
   * and reconcile balances every N seconds/minutes. Adjust the interval
   * to suit your production needs (e.g., once every 5 minutes).
   */
  private setupPeriodicTasks() {
    const INTERVAL_MS = 1000 * 10; // 5 minutes example

    setInterval(async () => {
      try {
        // For each supported market, snapshot the orderbook
        // const supportedMarkets = this.getSupportedMarkers();
        // for (const m of supportedMarkets) {
        //   const marketName = `${m.base}_${m.quote}`;
        //   await this.snapshotOrderbook(marketName);
        // }

        // Then reconcile all user balances vs DB
        await this.reconcileBalances();

        console.log("Periodic snapshot & reconcile completed.");
      } catch (error) {
        console.error("Periodic task error:", error);
      }
    }, INTERVAL_MS);
  }
  getSupportedMarkers(): Array<{ base: string; quote: string }> {
    // If you want more markets, add them here
    return [{ base: "BTC", quote: BASE_CURRENCY }];
  }

  async initialize() {
    console.log("Engine: Starting recovery process...");

    const supportedMarkets = this.getSupportedMarkers();

    // Initialize empty orderbooks
    for (const market of supportedMarkets) {
      const orderBook = new OrderBook(market.base, [], [], market.quote, 0, 0n);
      this.orderBooks.push(orderBook);
    }

    // 1) Load user balances from database
    this.loadAllBalancesFromDB();

    // 2) Recover state from the last snapshot + replay events
    // await this.recoverState();

    // 3) Start real-time Kline aggregator (if used)
    initRealTimeKlineAggregator();
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

  async loadBalanceForUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.log(`No user with ${userId} found in database to add balance`);
      return;
    }
    this.balance.set(userId, {
      USDC: { available: BigInt(user.usdcBalance), locked: 0n },
      BTC: { available: BigInt(user.btcBalance), locked: 0n },
    });
    console.log(`Engine: Loaded balance for user ${userId}`);
  }

  async recoverState() {
    for (const orderBook of this.orderBooks) {
      const market = orderBook.ticker();
      console.log(" recoverState ~ market:", market);
      try {
        const snapshotRecord = (await prisma.orderbookSnapshot.findUnique({
          where: { market },
        })) as OrderbookSnapshot | null;

        if (!snapshotRecord || !snapshotRecord.snapshot) {
          console.log(`Engine: No snapshot found for market ${market}`);
          continue;
        }

        const snapshot = JSON.parse(snapshotRecord.snapshot) as SnapshotData;

        orderBook.bids = snapshot.bids.map((order: any) => ({
          ...order,
          price: BigInt(order.price),
          quantity: BigInt(order.quantity),
          filled: BigInt(order.filled),
        }));

        orderBook.asks = snapshot.asks.map((order: any) => ({
          ...order,
          price: BigInt(order.price),
          quantity: BigInt(order.quantity),
          filled: BigInt(order.filled),
        }));

        orderBook.lastTradeId = snapshot.lastTradeId;
        orderBook.currentPrice = BigInt(snapshot.currentPrice);

        // Replay events from Redis that happened after the snapshot timestamp
        const snapshotTimestamp = snapshotRecord.updatedAt.getTime();
        await this.loadEventsFromRedis(snapshotTimestamp);
      } catch (error) {
        console.error(
          `Engine: Error loading snapshot for market ${market}:`,
          error
        );
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
      const events = eventsJson.map((json) => JSON.parse(json));
      events.sort((a, b) => a.timestamp - b.timestamp);
      console.log(`Engine: Replaying ${events.length} events from Redis`);
      for (const event of events) {
        this.applyEvents(event);
      }
    } catch (error) {
      console.log(`Engine: Error loading events from Redis`, error);
    }
  }

  async applyEvents(event: Event) {
    // Prevent duplicate processing.
    if (this.processedEventIds.has(event.id)) return;
    this.processedEventIds.add(event.id);

    switch (event.type) {
      case ORDER_CREATE: {
        const data = event.data;
        const market = data.market;
        const orderbook = this.orderBooks.find((o) => o.ticker() === market);
        if (!orderbook) {
          console.warn(
            `Engine: Orderbook for market ${market} not found during event replay.`
          );
          return;
        }
        // Reconstruct the order object from the event data.
        const order = {
          userId: data.userId,
          orderId: data.orderId,
          side: data.side,
          price: BigInt(data.price),
          quantity: BigInt(data.quantity),
          filled: 0n, // Assume no fills initially
          orderType: data.orderType, // "limit" or "market"
          createdAt: Date.now(),
        };
        // Replay by processing the order on the orderbook.
        orderbook.processOrder(order);
        break;
      }
      case ORDER_UPDATE: {
        const data = event.data;
        const market = data.market;
        const orderbook = this.orderBooks.find((o) => o.ticker() === market);
        if (!orderbook) {
          console.warn(
            `Engine: Orderbook for market ${market} not found during ORDER_UPDATE replay.`
          );
          return;
        }
        // Find the order in bids or asks.
        let order =
          orderbook.bids.find((o) => o.orderId === data.orderId) ||
          orderbook.asks.find((o) => o.orderId === data.orderId);
        if (order) {
          // Update the order's filled quantity.
          order.filled = BigInt(data.executedQty);
        } else {
          console.warn(
            `Engine: Order ${data.orderId} not found in memory for ORDER_UPDATE replay.`
          );
        }
        break;
      }
      default:
        console.warn(`Engine: Unknown event type ${event.type} during replay`);
    }
  }

  /**
   * onRamp: A user deposits funds (USDC).
   *  - Updates the in‑memory balance immediately.
   *  - Publishes a BALANCE_UPDATE event for DB persistence.
   */
  async onRamp(userId: string, amount: bigint) {
    if (amount <= 0n) {
      throw new Error("Invalid amount for onRamp");
    }
    const userBalance = this.balance.get(userId);
    if (!userBalance) {
      this.balance.set(userId, {
        [BASE_CURRENCY]: {
          available: amount,
          locked: 0n,
        },
      });
    } else {
      userBalance[BASE_CURRENCY].available += amount;
    }

    const event: Event = {
      id: this.generateUniqueId(),
      type: "BALANCE_UPDATE",
      data: {
        userId,
        asset: BASE_CURRENCY,
        available: this.balance
          .get(userId)!
          [BASE_CURRENCY].available.toString(),
        locked: this.balance.get(userId)![BASE_CURRENCY].locked.toString(),
      },
      timestamp: Date.now(),
    };
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
    // Update only USDC and BTC for demonstration
    await prisma.user.update({
      where: { id: userId },
      data: {
        usdcBalance: userBalance.USDC ? userBalance.USDC.available : 0n,
        btcBalance: userBalance.BTC ? userBalance.BTC.available : 0n,
      },
    });
  }

  /**
   * Main router for messages from the API/WebSocket.
   */
  public async process({
    message,
    clientId,
  }: {
    message: MessageFromAPI;
    clientId: string;
  }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const {
            market,
            quantity,
            price,
            side,
            userId,
            orderType,
            ioc,
            postOnly,
          } = message.data;
          const { executedQty, fills, orderId } = await this.createOrder(
            market,
            quantity,
            price,
            side,
            userId,
            orderType,
            ioc,
            postOnly
          );

          // Respond success
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty: executedQty.toString(),
              fills: fills.map((fill) => ({
                price: fill.price.toString(),
                quantity: fill.quantity.toString(),
                tradeId: fill.tradeId,
              })),
            },
          });

          // 1) Reconcile balances (ensures no mismatch if there's any DB or memory drift)
          await this.reconcileBalances();

          // 2) Snapshot the orderbook after the new order
          await this.snapshotOrderbook(market);
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_REJECTED",
            payload: {
              reason:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            },
          });
        }
        break;

      case CANCEL_ORDER:
        try {
          const { orderId, market, userId } = message.data;
          this.cancelOrder(orderId, market, clientId, userId);
        } catch (error) {
          console.log("Error while cancelling order");
          console.log(error);
        }
        break;

      case GET_OPEN_ORDERS:
        try {
          const { market, userId } = message.data;
          if (!market || typeof market !== "string") {
            throw new Error("Market not specified or invalid");
          }
          if (!userId || typeof userId !== "string") {
            throw new Error("User ID not specified or invalid");
          }

          const openOrderbook = this.orderBooks.find(
            (o) => o.ticker() === market
          );
          if (!openOrderbook) {
            throw new Error(`No orderbook found for market: ${market}`);
          }

          const openOrders = openOrderbook.getOpenOrders(userId);
          console.log(" openOrders ~ openOrders:", openOrders);
          const payload = openOrders.map((order) => ({
            orderId: order.orderId,
            filled: order.filled.toString(),
            price: order.price.toString(),
            quantity: order.quantity.toString(),
            side: order.side,
            userId: order.userId,
            createdAt: order.createdAt,
          }));

          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload,
          });
        } catch (error) {
          console.error("Error getting open orders:", error);
        }
        break;

      case ON_RAMP:
        try {
          const userId = message.data.userId;
          const amount = BigInt(message.data.amount);
          await this.onRamp(userId, amount);

          // Send success response back to API
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ON_RAMP_SUCCESS",
            payload: {
              userId,
              amount: amount.toString(),
            },
          });
        } catch (error) {
          console.error("Error in onRamp:", error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ON_RAMP_REJECTED",
            payload: {
              reason:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            },
          });
        }
        break;

      case GET_DEPTH:
        try {
          const market = message.data.market;
          if (!market || typeof market !== "string") {
            throw new Error("Invalid or missing market parameter");
          }
          const orderBook = this.orderBooks.find((o) => o.ticker() === market);
          if (!orderBook) {
            throw new Error(`No OrderBook found for market: ${market}`);
          }
          const depth = orderBook.getDepth();
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: depth,
          });
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: {
              bids: [],
              asks: [],
            },
          });
        }
        break;

      case SYNC_USER_BALANCE:
        try {
          const { userId } = message.data;
          await this.loadBalanceForUser(userId);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "SYNC_USER_BALANCE",
            payload: {
              message: "User balance synced",
            },
          });
        } catch (error) {
          console.error("Error syncing user balance:", error);
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
                high24h: "0",
                low24h: "0",
                volume24h: "0",
                open24h: "0",
                change24h: 0,
              },
            });
            return;
          }
          RedisManager.getInstance().sendToApi(clientId, {
            type: "TICKER_UPDATE",
            payload: {
              currentPrice: tickerData.last.toString(),
              high: tickerData.high.toString(),
              low: tickerData.low.toString(),
              volume: tickerData.volume.toString(),
              symbol: market,
              high24h: tickerData.high24h.toString(),
              low24h: tickerData.low24h.toString(),
              volume24h: tickerData.volume24h.toString(),
              open24h: tickerData.open24h.toString(),
              change24h: tickerData.change24h,
            },
          });
        } catch (error) {
          console.error("Error fetching ticker data:", error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "TICKER_UPDATE",
            payload: {
              currentPrice: "0",
              high: "0",
              low: "0",
              volume: "0",
              high24h: "0",
              low24h: "0",
              volume24h: "0",
              open24h: "0",
              change24h: 0,
            },
          });
        }
        break;

      case GET_USER_BALANCE:
        try {
          const { userId } = message.data;
          const userBalance = this.balance.get(userId);
          console.log(" process ~ userBalance:", userBalance);

          if (!userBalance) {
            throw new Error(`No balance found for user ${userId}`);
          }

          RedisManager.getInstance().sendToApi(clientId, {
            type: "GET_USER_BALANCE",
            payload: this.formatBalanceForTransport(userBalance),
          });
        } catch (error) {
          console.error("Error getting user balance:", error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ERROR",
            payload: {
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
            },
          });
        }
        break;
    }
  }

  /**
   * Create Order
   *  - Publishes ORDER_CREATE event
   *  - Locks user funds
   *  - Processes order against the matching engine
   *  - Updates in-memory balances of maker/taker (via updateBalance)
   *  - Publishes BALANCE_UPDATE events for everyone involved
   *  - Publishes ORDER_UPDATE events for each fill
   *  - Publishes trade events
   *  - Returns final executedQty and fill records
   */
  public async createOrder(
    market: string,
    rawQuantity: string,
    rawPrice: string,
    side: "buy" | "sell",
    userId: string,
    orderType: "limit" | "market",
    ioc?: boolean,
    postOnly?: boolean
  ): Promise<{ executedQty: bigint; fills: Fill[]; orderId: string }> {
    const orderbook = this.orderBooks.find((ob) => ob.ticker() === market);
    if (!orderbook) throw new Error(`No OrderBook found for ${market}`);

    if (postOnly) {
      const limitPrice = BigInt(rawPrice);
      if (orderbook.wouldTakeLiquidity(side, limitPrice)) {
        throw new Error(
          "Failed: Post-only order would match immediately (maker-only)"
        );
      }
    }

    const quantity = BigInt(rawQuantity);
    const price = orderType === "limit" ? BigInt(rawPrice) : 0n;
    const localOrderId = crypto.randomUUID();

    // 1) Publish ORDER_CREATE event to event store
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

    // 2) Lock user funds
    const [baseAsset, quoteAsset] = market.split("_");
    if (orderType === "limit") {
      this.checkAndLockFunds(
        baseAsset,
        quoteAsset,
        userId,
        price,
        side,
        quantity
      );
    } else {
      // Market order logic:
      if (side === "buy") {
        // Lock all available quote
        const userBalances = this.balance.get(userId);
        if (!userBalances)
          throw new Error(`No balance found for user ${userId}`);
        const estimatedCode = this.getEstimatedBuyCostForMarket(
          orderbook,
          quantity
        );
        if (userBalances[quoteAsset].available < estimatedCode) {
          throw new Error(`Insufficient ${quoteAsset} balance`);
        }
        // Lock only the estimated cost, not the entire available balance.
        userBalances[quoteAsset].available -= estimatedCode;
        userBalances[quoteAsset].locked += estimatedCode;
      } else {
        // Market sell => lock exactly the baseAsset
        this.checkAndLockFunds(
          baseAsset,
          quoteAsset,
          userId,
          0n,
          side,
          quantity
        );
      }
    }

    // 3) Process the order
    const order: Order = {
      userId,
      orderId: localOrderId,
      side,
      price,
      quantity,
      filled: 0n,
      orderType,
      createdAt: Date.now(),
      ioc,
      postOnly,
    };

    if (ioc && orderType !== "limit")
      throw new Error("IOC is only valid for limit orders");

    if (ioc && postOnly)
      throw new Error("IOC and Post Only cannot be combined");

    const { executedQty, fills } = orderbook.processOrder(order);

    if (ioc) {
      const unfilledQty = quantity - executedQty;
      if (unfilledQty > 0n) {
        const userBalance = this.balance.get(userId);
        if (!userBalance)
          throw new Error(`No balance found for user ${userId}`);
        if (side === "buy") {
          const totalCost = mulDiv(price, unfilledQty, BTC_SCALE.toString());
          userBalance[quoteAsset].available += totalCost;
          userBalance[quoteAsset].locked -= totalCost;
        } else {
          userBalance[baseAsset].available += unfilledQty;
          userBalance[baseAsset].locked -= unfilledQty;
        }
      }
    }

    //Update the open orders for touched users for an order
    const touchedUsers = new Set<string>();
    touchedUsers.add(userId); // taker
    for (const f of fills) touchedUsers.add(f.makerUserId!);

    this.publishOpenOrdersSnapshot(orderbook, [...touchedUsers]);

    console.log("fills", fills);
    // 4) Update balances in memory for taker & maker(s)
    this.updateBalance(userId, baseAsset, quoteAsset, side, fills);

    // -- BUY-side price-difference refund -------------------------
    if (side === "buy") {
      const costExecuted = fills.reduce(
        (acc, f) => acc + mulDiv(f.price, f.quantity, BTC_SCALE.toString()),
        0n
      );
      const worstCase = mulDiv(price, executedQty, BTC_SCALE.toString());
      const diff = worstCase - costExecuted; // positive when trades were cheaper
      if (diff > 0n) {
        const qb = this.balance.get(userId)![quoteAsset];
        qb.locked -= diff;
        qb.available += diff;
      }
    }
    // -------------------------------------------------------------

    // 5) Publish BALANCE_UPDATE events so the DB stays consistent
    //    (We do this for taker + any maker user IDs.)
    this.publishBalanceUpdates(userId, baseAsset, quoteAsset);
    for (const fill of fills) {
      if (fill.makerUserId) {
        this.publishBalanceUpdates(fill.makerUserId, baseAsset, quoteAsset);
      }
    }

    // 6) Publish trade & order updates to DB (via event store)
    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);

    // 7) Publish real-time websockets for depth/trades/ticker
    // 7) Publish real-time WebSocket updates for depth/trades/ticker
    if (orderType === "market") {
      // For market orders, update depth for all affected price levels
      this.publishWsMarketDepthUpdate(fills, market);
    } else {
      this.publishWsDepthUpdates(fills, price, side, market);
    }
    // this.publishOpenOrders(order, userId, executedQty, fills);
    this.publishWsTrades(fills, market, userId);
    this.updateAndPublishTicker(fills, market);

    return { executedQty, fills, orderId: localOrderId };
  }

  getEstimatedBuyCostForMarket(orderbook: OrderBook, quantity: bigint): bigint {
    const asksCopy = [...orderbook.asks].sort((a, b) =>
      a.price < b.price ? -1 : 1
    );
    let estimateCost = 0n;
    let remainingQuantity = quantity;
    for (const ask of asksCopy) {
      // Available quantity at this ask = (total quantity - already filled)
      const available = ask.quantity - ask.filled;
      if (available <= 0n) continue;

      const fillQty =
        available < remainingQuantity ? available : remainingQuantity;
      estimateCost += mulDiv(ask.price, fillQty, BTC_SCALE.toString());
      remainingQuantity -= fillQty;

      if (remainingQuantity == 0n) break;
    }
    if (remainingQuantity > 0n) {
      throw new Error(
        `Not enough liquidity available to fill the market order`
      );
    }
    return estimateCost;
  }

  /**
   * Lock the user's funds in memory
   */
  private checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    userId: string,
    price: bigint,
    side: "buy" | "sell",
    quantity: bigint
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
      userBalances[quoteAsset].available -= totalCost;
      userBalances[quoteAsset].locked += totalCost;
    } else {
      // side = sell
      if (userBalances[baseAsset].available < quantity) {
        throw new Error(`Insufficient ${baseAsset} balance`);
      }
      userBalances[baseAsset].available -= quantity;
      userBalances[baseAsset].locked += quantity;
    }
  }

  /**
   * Cancel an existing order and free up locked balances.
   */
  public cancelOrder(
    orderId: string,
    market: string,
    clientId: string,
    userId: string
  ) {
    const cancelOrderbook = this.orderBooks.find((o) => o.ticker() === market);
    if (!cancelOrderbook) {
      throw new Error("No orderbook found");
    }

    const [baseAsset, quoteAsset] = market.split("_");
    const order =
      cancelOrderbook.asks.find((o) => o.orderId === orderId) ||
      cancelOrderbook.bids.find((o) => o.orderId === orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.side === "buy") {
      const price = cancelOrderbook.cancelBid(order);
      if (!price) throw new Error("Order price not found");

      // leftover = (quantity - filled) * price
      const leftoverLocked = (order.quantity - order.filled) * order.price;
      const userBalances = this.balance.get(order.userId);
      if (!userBalances) throw new Error(`User ${order.userId} not found`);
      userBalances[quoteAsset].available += leftoverLocked;
      userBalances[quoteAsset].locked -= leftoverLocked;

      this.sendUpdatedDepthAt(price.toString(), market);
    } else {
      // side = sell
      const price = cancelOrderbook.cancelAsk(order);
      if (!price) throw new Error("Order price not found");

      const leftoverLocked = order.quantity - order.filled;
      const userBalances = this.balance.get(order.userId);
      if (!userBalances) throw new Error(`User ${order.userId} not found`);
      userBalances[baseAsset].available += leftoverLocked;
      userBalances[baseAsset].locked -= leftoverLocked;

      this.sendUpdatedDepthAt(price.toString(), market);
    }

    // Return message
    RedisManager.getInstance().sendToApi(clientId, {
      type: "ORDER_CANCELLED",
      payload: {
        orderId,
        executedQty: order.filled.toString(),
        remainingQty: (order.quantity - order.filled).toString(),
      },
    });
    this.publishOpenOrdersSnapshot(cancelOrderbook, [order.userId]);
  }

  // public publishOpenOrders(
  //   order: Order,
  //   userId: string,
  //   executedQty: bigint,
  //   fills: Fill[]
  // ) {
  //   RedisManager.getInstance().publishMessage(`orders@${userId}`, {
  //     stream: `orders@${userId}`,
  //     data: {
  //       e: "order",
  //       oI: order?.orderId,
  //       s: order.side,
  //       p: order.price,
  //       q: order.quantity,
  //       eq: executedQty.toString(),
  //       t: order.createdAt,
  //     },
  //   });
  //   // fills [
  //   //   {
  //   //     price: 50500000n,
  //   //     quantity: 50000000n,
  //   //     tradeId: 0,
  //   //     makerUserId: 'user1',
  //   //     makerOrderId: '3e92359c-7cbb-4eb1-9383-0371f57b32a5',
  //   //     timestamp: 1748676193449
  //   //   }
  //   // ]
  //   for (const fill of fills) {
  //     RedisManager.getInstance().publishMessage(`orders@${fill?.makerUserId}`, {
  //       stream: `orders@${fill?.makerUserId}`,
  //       data: {
  //         e: "order",
  //         oI: fill?.makerOrderId,
  //         s: order?.side == "buy" ? "buy" : "sell",
  //         p: fill?.price,
  //         q: fill?.quantity,
  //         eq: executedQty?.toString(),
  //         t: order?.createdAt,
  //       },
  //     });
  //   }
  // }
  /**
   * Push the ENTIRE open-order snapshot for every user that was touched
   * by the last match.  That guarantees consistency even after many
   * partial fills, cancels, or edits.
   */
  private publishOpenOrdersSnapshot(
    orderbook: OrderBook,
    userIds: string[] // taker + every maker
  ) {
    console.log(userIds);
    for (const uid of userIds) {
      const orders = orderbook.getOpenOrders(uid).map((o) => ({
        oI: o.orderId,
        s: o.side, // correct side
        p: o.price.toString(),
        q: o.quantity.toString(), // full size
        eQ: o.filled.toString(), // cumulative fill for THIS order
        st:
          o.filled === o.quantity
            ? "FILLED"
            : o.filled === 0n
            ? "NEW"
            : "PARTIALLY_FILLED",
        t: o.createdAt, // original ts
      }));

      RedisManager.getInstance().publishMessage(`orders@${uid}`, {
        stream: `orders@${uid}`,
        data: { e: "openOrders", orders },
      });
    }
  }

  /**
   * Update maker & taker in-memory balances after a trade.
   * (We do not publish DB updates here; we just fix the memory.)
   */
  public updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[]
  ) {
    const takerBalances = this.balance.get(userId);
    if (!takerBalances) return;

    if (side === "buy") {
      // Taker is the buyer
      for (const fill of fills) {
        const makerBalances = this.balance.get(fill.makerUserId!);
        if (!makerBalances) continue;

        // quote to maker, base to taker
        const quoteAmount = mulDiv(
          fill.price,
          fill.quantity,
          BTC_SCALE.toString()
        );

        // Maker = seller
        makerBalances[quoteAsset].available += quoteAmount;
        makerBalances[baseAsset].available -= fill.quantity; // they'd locked base previously

        // Taker = buyer
        takerBalances[quoteAsset].locked -= quoteAmount; // we had locked quote
        takerBalances[baseAsset].available += fill.quantity;
      }
    } else {
      // Taker is the seller
      for (const fill of fills) {
        const makerBalances = this.balance.get(fill.makerUserId!);
        if (!makerBalances) continue;

        // Buyer locked some quote
        const quoteAmount = mulDiv(
          fill.price,
          fill.quantity,
          BTC_SCALE.toString()
        );

        // Maker = buyer
        makerBalances[quoteAsset].locked -= quoteAmount;
        makerBalances[baseAsset].available += fill.quantity;

        // Taker = seller
        takerBalances[quoteAsset].available += quoteAmount;
        takerBalances[baseAsset].locked -= fill.quantity;
      }
    }
  }

  /**
   * Publish a BALANCE_UPDATE event for a user's current base & quote asset.
   * This ensures the DB eventually sees the updated in-memory balances.
   */
  private publishBalanceUpdates(
    userId: string,
    baseAsset: string,
    quoteAsset: string
  ) {
    const userBalances = this.balance.get(userId);
    if (!userBalances) return;

    // Publish for baseAsset
    {
      const event: Event = {
        id: this.generateUniqueId(),
        type: "BALANCE_UPDATE",
        data: {
          userId,
          asset: baseAsset,
          available: userBalances[baseAsset].available.toString(),
          locked: userBalances[baseAsset].locked.toString(),
        },
        timestamp: Date.now(),
      };
      EventStore.publishEvent(event);
    }
    // Publish for quoteAsset
    {
      const event: Event = {
        id: this.generateUniqueId(),
        type: "BALANCE_UPDATE",
        data: {
          userId,
          asset: quoteAsset,
          available: userBalances[quoteAsset].available.toString(),
          locked: userBalances[quoteAsset].locked.toString(),
        },
        timestamp: Date.now(),
      };
      EventStore.publishEvent(event);
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
          quoteQuantity: mulDiv(
            fill.price,
            fill.quantity,
            BTC_SCALE.toString()
          ).toString(),
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

  updateDbOrders(
    order: Order,
    executedQty: bigint,
    fills: Fill[],
    market: string
  ) {
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

    // Also update the maker orders
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

  /**
   * Re-check the DB vs in-memory balances to detect any mismatch.
   * For simplicity, we just log errors if found.
   * You could optionally fix them or raise an alert.
   */
  public async reconcileBalances() {
    const dbUsers = await prisma.user.findMany();
    for (const user of dbUsers) {
      const memBalance = this.balance.get(user.id);
      if (memBalance) {
        const dbUSDC = BigInt(user.usdcBalance);
        if (memBalance.USDC.available !== dbUSDC) {
          console.error(
            `Reconciliation discrepancy for user ${user.id}: In‑memory USDC=${memBalance.USDC.available} vs DB=${dbUSDC}`
          );
          // Optionally reissue an event or correct it
          const event: Event = {
            id: this.generateUniqueId(),
            type: "BALANCE_UPDATE",
            data: {
              userId: user.id,
              asset: BASE_CURRENCY,
              available: memBalance.USDC.available.toString(),
              locked: memBalance.USDC.locked.toString(),
            },
            timestamp: Date.now(),
          };
          await EventStore.publishEvent(event);
        }
        // You can check BTC similarly:
        // const dbBTC = BigInt(user.btcBalance);
        // if (memBalance.BTC.available !== dbBTC) {...}
      } else {
        console.warn(`User ${user.id} missing in memory during reconciliation`);
      }
    }
    console.log("Reconciliation: Completed balance check.");
  }

  /**
   * Snapshot the entire orderbook for a single market and publish an event for DB.
   */
  public async snapshotOrderbook(market: string) {
    const orderbook = this.orderBooks.find((ob) => ob.ticker() === market);
    if (!orderbook) {
      console.error(`No orderbook found for market ${market} to snapshot`);
      return;
    }
    const snapshot = orderbook.getSnapshot();
    const event: Event = {
      id: this.generateUniqueId(),
      type: "ORDERBOOK_SNAPSHOT",
      data: {
        market,
        snapshot: JSON.stringify(snapshot, (_, value) =>
          typeof value === "bigint" ? value.toString() : value
        ),
      },
      timestamp: Date.now(),
    };
    await EventStore.publishEvent(event);
    console.log(`Snapshot published for market ${market}`);
  }

  /**
   * Send updated depth for the impacted prices after a fill.
   */
  public publishWsDepthUpdates(
    fills: Fill[],
    price: bigint,
    side: "buy" | "sell",
    market: string
  ) {
    const orderbook = this.orderBooks.find((o) => o.ticker() === market);
    if (!orderbook) return;

    const depth = orderbook.getDepth();
    const priceStr = price.toString();

    if (side === "buy") {
      const affectedPrices = new Set(
        fills.map((fill) => fill.price.toString())
      );
      const updatedAsks = depth.asks.filter((x) => affectedPrices.has(x[0]));

      const updatedBid = depth.bids.find((x) => x[0] === priceStr);

      for (const price of affectedPrices) {
        const askStillExists = depth.asks.some(([p]) => p === price);
        console.log(
          `🔍 Checking if ask ${price} still exists:`,
          askStillExists
        );

        if (!askStillExists) {
          console.log(`❌ Ask ${price} not found — pushing [${price}, "0"]`);
          updatedAsks.push([price, "0"]);
        }
      }

      console.log("✅ Final updatedAsks to send:", updatedAsks);

      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsks,
          b: updatedBid ? [updatedBid] : [],
          e: "depth",
        },
      });
    } else {
      // side = sell
      const affectedPrices = new Set(
        fills.map((fill) => fill.price.toString())
      );
      const updatedBids = depth.bids.filter((x) =>
        fills.some((f) => f.price.toString() === x[0])
      );
      const updatedAsk = depth.asks.find((x) => x[0] === priceStr);
      for (const price of affectedPrices) {
        const bidStillExists = depth.bids.some(([p]) => p === price);
        if (!bidStillExists) {
          updatedBids.push([price, "0"]);
        }
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
  public publishWsMarketDepthUpdate(fills: Fill[], market: string): void {
    // Use a Set to deduplicate prices from the fills.
    const uniquePrices = new Set<string>();
    for (const fill of fills) {
      uniquePrices.add(fill.price.toString());
    }

    // For each unique price level affected by the market order,
    // publish the updated depth at that price level.
    uniquePrices.forEach((price) => {
      this.sendUpdatedDepthAt(price, market);
    });
  }

  /**
   * Publish trades to WS and aggregator
   */
  public publishWsTrades(fills: Fill[], market: string, userId: string) {
    for (const fill of fills) {
      const isBuyerMaker = fill.makerUserId === userId;
      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: isBuyerMaker,
          p: fill.price.toString(),
          q: fill.quantity.toString(),
          s: market,
          T: fill.timestamp,
        },
      });

      // For aggregator
      RedisManager.getInstance().publishMessage(`trade_channel`, {
        type: "TRADE_ADDED",
        data: {
          market,
          price: fill.price.toString(),
          quantity: fill.quantity.toString(),
          timestamp: fill.timestamp,
        },
      });
    }
  }

  /**
   * Update ticker aggregator and push out
   */
  public updateAndPublishTicker(fills: Fill[], market: string) {
    for (const fill of fills) {
      tickerAggregator.updateTicker(market, {
        price: fill.price,
        quantity: fill.quantity,
      });
      const tickerData = tickerAggregator.getTicker(market);
      if (!tickerData) continue;
      RedisManager.getInstance().publishMessage(`ticker@${market}`, {
        stream: "ticker",
        data: {
          c: tickerData.last.toString(),
          h: tickerData.high.toString(),
          l: tickerData.low.toString(),
          v: tickerData.volume.toString(),
          h24: tickerData.high24h.toString(),
          l24: tickerData.low24h.toString(),
          v24: tickerData.volume24h.toString(),
          o24: tickerData.open24h.toString(),
          ch24: tickerData.change24h,
          s: market,
          id: tickerData.updatedAt,
          e: "ticker",
        },
      });
    }
  }

  private formatBalanceForTransport(balance: any) {
    if (!balance) return null;

    const formatted: any = {};
    for (const [asset, amounts] of Object.entries(balance)) {
      formatted[asset] = {
        // Convert BigInt to string
        available: (amounts as any).available.toString(),
        locked: (amounts as any).locked.toString(),
      };
    }
    console.log(" formatBalanceForTransport ~ formatted:", formatted);
    return formatted;
  }
}
