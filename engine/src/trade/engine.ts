//@ts-nocheck
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

const ALERT_THRESHOLD: Record<string, bigint> = {
  USDC: 1_000_000_000n, // $1 000 (6-decimals USDC)
  BTC: 100_000n, // 0.001 BTC (8-decimals)
};

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
  // private processedEventIds: Set<string> = new Set(); // For idempotency

  constructor() {
    this.initialize();
    this.setupPeriodicTasks();
  }

  /**
   * This function sets up periodic tasks to snapshot orderbooks
   * and reconcile balances every N seconds/minutes. Adjust the interval
   * to suit your production needs (e.g., once every 5 minutes).
   */
  // engine/Engine.ts
  private setupPeriodicTasks() {
    const SNAPSHOT_MS = Number(process.env.SNAPSHOT_MS ?? 5000); // default 5 s
    const RECONCILE_MS = Number(process.env.RECONCILE_MS ?? 60000); // default 60 s

    let lastRecon = 0; // timestamp of last reconcile
    let reconFails = 0; // consecutive failures

    setInterval(async () => {
      try {
        /* 1️⃣ Snapshot every supported market */
        for (const { base, quote } of this.getSupportedMarkers()) {
          await this.snapshotOrderbook(`${base}_${quote}`);
        }

        /* 2️⃣ Reconcile balances if interval elapsed */
        const now = Date.now();
        if (now - lastRecon >= RECONCILE_MS) {
          try {
            await this.reconcileBalances();
            reconFails = 0; // success ⇒ reset counter
          } catch (e) {
            reconFails++;
            console.error("⚠️  reconcileBalances failed:", e);
            // Optional: exponential back-off after multiple failures
            if (reconFails >= 3) {
              console.error("⏳ backing off reconcile for 5× interval");
              lastRecon = now - RECONCILE_MS * 4; // skip next 4 runs
            }
          }
          lastRecon = now;
        }
      } catch (err) {
        /* Any unexpected error stays inside the loop */
        console.error("⛔ periodicTasks loop error:", err);
      }
    }, SNAPSHOT_MS);
  }

  getSupportedMarkers(): Array<{ base: string; quote: string }> {
    // If you want more markets, add them here
    return [{ base: "BTC", quote: BASE_CURRENCY }];
  }

  async initialize() {
    console.log("Engine: Starting recovery process...");

    const supportedMarkets = this.getSupportedMarkers();

    // Initialize empty orderbooks
    // engine/Engine.ts  → initialize()
    for (const { base, quote } of this.getSupportedMarkers()) {
      /* 1️⃣ build an empty book right away */
      const ob = new OrderBook(base, [], [], quote, 0, 0n);
      this.orderBooks.push(ob);

      const json = await RedisManager.getInstance().get(
        `ticker:${base}_${quote}`
      );
      if (json) {
        const { snapshot, history } = JSON.parse(json);
        tickerAggregator.hyderateTicker(`${base}_${quote}`, snapshot, history);
        continue;
      }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 h ago
      const rows = await prisma.trade.findMany({
        where: { market: `${base}_${quote}`, timestamp: { gte: since } },
        orderBy: { timestamp: "asc" },
      });

      for (const r of rows) {
        tickerAggregator.updateTicker(`${base}_${quote}`, {
          price: BigInt(r.price),
          quantity: BigInt(r.quantity),
        });
      }
    }

    // 1) Load user balances from database
    this.loadAllBalancesFromDB();

    // 2) Recover state from the last snapshot + replay events
    await this.recoverState();

    // 3) Start real-time Kline aggregator (if used)
    initRealTimeKlineAggregator();
  }

  async loadAllBalancesFromDB() {
    const allUsers = await prisma.user.findMany();
    for (const user of allUsers) {
      this.balance.set(user.id, {
        USDC: {
          available: BigInt(user.usdcBalance),
          locked: BigInt(user.usdcLocked),
        },
        BTC: {
          available: BigInt(user.btcBalance),
          locked: BigInt(user.btcLocked),
        },
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
      USDC: {
        available: BigInt(user.usdcBalance),
        locked: BigInt(user.usdcLocked),
      },
      BTC: {
        available: BigInt(user.btcBalance),
        locked: BigInt(user.btcLocked),
      },
    });
    console.log(`Engine: Loaded balance for user ${userId}`);
  }

  async recoverState() {
    for (const orderBook of this.orderBooks) {
      const market = orderBook.ticker();
      console.log("Engine: recovering market", market);
      try {
        const snapshotRecord = await prisma.orderbookSnapshot.findFirst({
          where: { market },
          orderBy: { createdAt: "desc" }, // newest snapshot
        });
        if (!snapshotRecord) {
          console.log(`Engine: No snapshot for ${market}`);
          continue;
        }

        // rebuild in-memory book from that snapshot
        const raw = snapshotRecord.snapshot;

        if (typeof raw !== "string") {
          throw new Error(`Invalid snapshot format for market: ${market}`);
        }

        const snap = JSON.parse(raw) as SnapshotData;

        orderBook.bids = snap.bids.map((o: any) => ({
          ...o,
          price: BigInt(o.price),
          quantity: BigInt(o.quantity),
          filled: BigInt(o.filled),
        }));
        orderBook.asks = snap.asks.map((o: any) => ({
          ...o,
          price: BigInt(o.price),
          quantity: BigInt(o.quantity),
          filled: BigInt(o.filled),
        }));
        orderBook.lastTradeId = snap.lastTradeId;
        orderBook.currentPrice = BigInt(snap.currentPrice);

        // now replay *after* that snapshot’s stream ID
        await this.loadEventsFromStream(snapshotRecord.streamId);
      } catch (err) {
        console.error(`Engine: failed to recover ${market}`, err);
      }
    }
  }

  // async loadEventsFromRedis(snapshotTimestamp: number) {
  //   try {
  //     const minScore = snapshotTimestamp ? `(${snapshotTimestamp}` : "0";
  //     const eventsJson = await RedisManager.getInstance().getZRangeByScore(
  //       "event_store",
  //       minScore,
  //       "+inf"
  //     );
  //     const events = eventsJson.map((json) => JSON.parse(json));
  //     events.sort((a, b) => a.timestamp - b.timestamp);
  //     console.log(`Engine: Replaying ${events.length} events from Redis`);
  //     for (const event of events) {
  //       this.applyEvents(event);
  //     }
  //   } catch (error) {
  //     console.log(`Engine: Error loading events from Redis`, error);
  //   }
  // }

  // private async loadEventsFromStream(startId: string) {
  //   const manager = RedisManager.getInstance();
  //   const GROUP = "engine-replay";
  //   const CONSUMER = "replay-" + Math.random().toString(36).slice(2, 7);

  //   // create consumer-group if needed
  //   try {
  //     await manager.xGroupCreate({
  //       key: "events",
  //       group: GROUP,
  //       id: "0",
  //       MKSTREAM: true,
  //     });
  //   } catch (e: any) {
  //     if (!e.message.includes("BUSYGROUP")) throw e;
  //   }

  //   let cursor = startId;
  //   while (true) {
  //     const resp = await manager.xReadGroup(
  //       GROUP,
  //       CONSUMER,
  //       { key: "events", id: cursor },
  //       { COUNT: 100, BLOCK: 0 }
  //     );
  //     if (!resp) break;
  //     for (const stream of resp) {
  //       for (const msg of stream.messages) {
  //         const ev: Event = JSON.parse(msg.message.json as string);
  //         this.applyEvents(ev);
  //         cursor = msg.id;
  //       }
  //     }
  //   }
  // }

  private async loadEventsFromStream(startId: string) {
    const rm = RedisManager.getInstance();
    const GROUP = "engine-replay";
    const CONSUMER = `engine-${crypto.randomUUID().slice(0, 6)}`;

    // …consumer-group creation…

    // 2) FIRST: drain any *pending* messages (un-acked from last run)
    while (true) {
      const pendingResp = await rm.xReadGroup(
        GROUP,
        CONSUMER,
        { key: "events", id: startId }, // start at last snapshot ID
        { COUNT: 100, BLOCK: 5000 }
      );
      if (!pendingResp || pendingResp[0].messages.length === 0) break;
      for (const msg of pendingResp[0].messages) {
        const ev = JSON.parse(msg.message.json);
        ev.id ??= msg.id;
        try {
          await this.applyEvents(ev);
          await rm.xAck("events", GROUP, msg.id);
        } catch (err) {
          console.error("Failed to apply pending event", ev.id, err);
          // leave un-acked to retry later
        }
      }
    }

    // 3) NOW consume only *new* events
    while (true) {
      const resp = await rm.xReadGroup(
        GROUP,
        CONSUMER,
        { key: "events", id: ">" },
        { COUNT: 100, BLOCK: 5000 }
      );
      if (!resp) continue;
      for (const msg of resp[0].messages) {
        const ev = JSON.parse(msg.message.json);
        ev.id ??= msg.id;
        try {
          await this.applyEvents(ev);
          await rm.xAck("events", GROUP, msg.id);
        } catch (err) {
          console.error("Failed to apply new event", ev.id, err);
          // un-acked ⇒ will be retried on next startup
        }
      }
    }
  }

  async applyEvents(event: Event) {
    const alreadyProcessed = await prisma.engineProcessedEvent.findUnique({
      where: { id: event.id! },
    });
    if (alreadyProcessed) {
      return; // skip processing
    }

    switch (event.type) {
      case "ORDERBOOK_SNAPSHOT":
        return; // bookmark-only, never applied
      /* ---------- orders --------------------------------------- */
      case ORDER_CREATE: {
        const d = event.data;
        const ob = this.orderBooks.find((o) => o.ticker() === d.market);
        if (!ob) {
          console.warn(`replay: no book ${d.market}`);
          break;
        }

        ob.insertWithoutMatching({
          orderId: d.orderId,
          userId: d.userId,
          side: d.side,
          price: BigInt(d.price),
          quantity: BigInt(d.quantity),
          filled: 0n,
          orderType: d.orderType,
          createdAt: d.timestamp,
        });
        break;
      }

      case ORDER_UPDATE: {
        const d = event.data;
        const ob = this.orderBooks.find((o) => o.ticker() === d.market);
        if (!ob) break;

        // inside your ORDER_UPDATE handling
        const ord = ob.findOrder(d.orderId);
        if (!ord) break;

        ord.filled = BigInt(d.executedQty);

        // remove only when fully filled (or if you have other criteria)
        if (ord.filled === ord.quantity) {
          ob.removeOrder(ord.orderId); // ← pass the ID, not the object
        }

        break;
      }
      case "DEPOSIT": {
        const { userId, asset, amount } = event.data;
        const w = this.balance.get(userId)!;
        w[asset].available += BigInt(amount);
        break;
      }

      case "ORDER_CANCEL": {
        const { orderId, market } = event.data;
        this.orderBooks
          .find((ob) => ob.ticker() === market)
          ?.removeOrder(orderId);
        break;
      }
      /* ---------- wallet moves --------------------------------- */
      case "BALANCE_LOCK": {
        const w = this.balance.get(event.data.userId);
        if (!w) break;
        const a = event.data.asset;
        const amt = BigInt(event.data.amount);
        w[a].available -= amt;
        w[a].locked += amt;
        break;
      }
      case "BALANCE_UNLOCK": {
        const w = this.balance.get(event.data.userId);
        if (!w) break;
        const a = event.data.asset;
        const amt = BigInt(event.data.amount);
        w[a].locked -= amt;
        w[a].available += amt;
        break;
      }

      case "TRADE_FILL": {
        const { buyUserId, sellUserId, baseAsset, quoteAsset, qty, quote } =
          event.data;
        const buy = this.balance.get(buyUserId)!;
        const sell = this.balance.get(sellUserId)!;
        buy[quoteAsset].locked -= BigInt(quote);
        buy[baseAsset].available += BigInt(qty);
        sell[baseAsset].locked -= BigInt(qty);
        sell[quoteAsset].available += BigInt(quote);
        break;
      }

      default:
      // ignore other event types during replay
    }
    await prisma.engineProcessedEvent.create({
      data: { id: event.id! },
    });
  }

  /**
   * onRamp: A user deposits funds (USDC).
   *  - Updates the in‑memory balance immediately.
   *  - Publishes a BALANCE_UPDATE event for DB persistence.
   */
  async onRamp(userId: string, amount: bigint) {
    if (amount <= 0n) throw new Error("Invalid amount");

    // 1️⃣ update RAM
    const bal = this.balance.get(userId) ?? {
      [BASE_CURRENCY]: { available: 0n, locked: 0n },
    };
    bal[BASE_CURRENCY].available += amount;
    this.balance.set(userId, bal);

    // 2️⃣ durable ledger event
    await EventStore.publishEvent({
      type: "DEPOSIT",
      data: {
        userId,
        asset: BASE_CURRENCY, // "USDC"
        amount: amount.toString(), // delta, not total
      },
      timestamp: Date.now(),
    });
  }

  generateUniqueId(): string {
    return crypto.randomUUID();
  }

  // async persistBalanceUpdate(userId: string) {
  //   const userBalance = this.balance.get(userId);
  //   if (!userBalance) {
  //     console.error(`No balance found for user ${userId}`);
  //     return;
  //   }
  //   // Update only USDC and BTC for demonstration
  //   await prisma.user.update({
  //     where: { id: userId },
  //     data: {
  //       usdcBalance: userBalance.USDC ? userBalance.USDC.available : 0n,
  //       btcBalance: userBalance.BTC ? userBalance.BTC.available : 0n,
  //     },
  //   });
  // }

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
    await EventStore.publishEvent(orderCreateEvent);

    // 2) Lock user funds
    const [baseAsset, quoteAsset] = market.split("_");
    if (orderType === "limit") {
      await this.checkAndLockFunds(
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
        const estimatedCost = this.getEstimatedBuyCostForMarket(
          orderbook,
          quantity
        );
        if (userBalances[quoteAsset].available < estimatedCost) {
          throw new Error(`Insufficient ${quoteAsset} balance`);
        }
        // Lock only the estimated cost, not the entire available balance.
        await this.emitBalanceLock(userId, quoteAsset, estimatedCost);
      } else {
        // Market sell => lock exactly the baseAsset
        await this.checkAndLockFunds(
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

    // console.error(
    //   "💥 Crash-test: exiting immediately after match, before settlement"
    // );
    // process.exit(1);

    if (ioc) {
      const unfilledQty = quantity - executedQty;
      if (unfilledQty > 0n) {
        const userBalance = this.balance.get(userId);
        if (!userBalance)
          throw new Error(`No balance found for user ${userId}`);
        const refund =
          side === "buy"
            ? mulDiv(price, unfilledQty, BTC_SCALE.toString()) // quote refund
            : unfilledQty; // base refund

        const asset = side === "buy" ? quoteAsset : baseAsset;
        await this.emitBalanceUnlock(userId, asset, refund);
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
      const diff = worstCase - costExecuted;
      if (diff > 0n) {
        // Treat refund as “unlock the leftover quote”
        await this.emitBalanceUnlock(userId, quoteAsset, diff);
      }
    }
    // -------------------------------------------------------------

    // 5) Publish BALANCE_UPDATE events so the DB stays consistent
    //    (We do this for taker + any maker user IDs.)
    // this.publishBalanceUpdates(userId, baseAsset, quoteAsset);
    // for (const fill of fills) {
    //   if (fill.makerUserId) {
    //     this.publishBalanceUpdates(fill.makerUserId, baseAsset, quoteAsset);
    //   }
    // }

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
  private async checkAndLockFunds(
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
      await this.emitBalanceLock(userId, quoteAsset, totalCost);
    } else {
      // side = sell
      if (userBalances[baseAsset].available < quantity) {
        throw new Error(`Insufficient ${baseAsset} balance`);
      }
      await this.emitBalanceLock(userId, baseAsset, quantity);
    }
  }

  private async emitBalanceLock(userId: string, asset: string, amount: bigint) {
    if (amount == 0n) return;

    const evt: Event = {
      type: "BALANCE_LOCK",
      data: { userId, asset, amount: amount.toString() },
      timestamp: Date.now(),
    };

    await EventStore.publishEvent(evt);

    // 2️⃣ mutate RAM only after Redis ACK
    const wallet = this.balance.get(userId);
    if (!wallet) throw new Error(`Wallet missing for ${userId}`);

    wallet[asset].available -= amount;
    wallet[asset].locked += amount;
  }

  /* -------------------------------------------------------------
   *  Publish BALANCE_UNLOCK ➜ wait for ACK ➜ mutate RAM
   * ----------------------------------------------------------- */
  private async emitBalanceUnlock(
    userId: string,
    asset: string,
    amount: bigint
  ): Promise<void> {
    if (amount === 0n) return;

    const evt: Event = {
      type: "BALANCE_UNLOCK",
      data: { userId, asset, amount: amount.toString() },
      timestamp: Date.now(),
    };

    await EventStore.publishEvent(evt); // 1️⃣ durable write

    const wallet = this.balance.get(userId);
    if (!wallet) throw new Error(`Wallet missing for ${userId}`);

    wallet[asset].locked -= amount; // 2️⃣ mutate after ACK
    wallet[asset].available += amount;
  }

  /* ---------------------------------------------------------------
   *  Publish TRADE_FILL  → wait for ACK → apply to RAM
   * ------------------------------------------------------------- */
  private async emitTradeFill(
    buyUserId: string,
    sellUserId: string,
    baseAsset: string, // e.g. "BTC"
    quoteAsset: string, // e.g. "USDC"
    price: bigint, // match price
    qty: bigint // executed base qty
  ): Promise<void> {
    if (qty === 0n) return;

    const quote = mulDiv(price, qty, BTC_SCALE.toString()); // cost = p*q

    const evt: Event = {
      type: "TRADE_FILL",
      data: {
        buyUserId,
        sellUserId,
        baseAsset,
        quoteAsset,
        price: price.toString(),
        qty: qty.toString(),
        quote: quote.toString(),
      },
      timestamp: Date.now(),
    };

    await EventStore.publishEvent(evt); // ① durable write

    /* ② mutate RAM only after Redis ACK  ------------------------- */

    const buyW = this.balance.get(buyUserId)!;
    const sellW = this.balance.get(sellUserId)!;

    // buyer
    buyW[quoteAsset].locked -= quote;
    buyW[baseAsset].available += qty;

    // seller
    sellW[baseAsset].locked -= qty;
    sellW[quoteAsset].available += quote;
  }

  private async emitBalanceMismatch(data: {
    userId: string;
    asset: "USDC" | "BTC";
    ledgerAvail: bigint;
    walletAvail: bigint;
    diffAvail: bigint;
    ledgerLocked: bigint;
    walletLocked: bigint;
    diffLocked: bigint;
  }) {
    await EventStore.publishEvent({
      type: "BALANCE_MISMATCH",
      data: {
        userId: data.userId,
        asset: data.asset,
        ledgerAvail: data.ledgerAvail.toString(),
        walletAvail: data.walletAvail.toString(),
        diffAvail: data.diffAvail.toString(),
        ledgerLocked: data.ledgerLocked.toString(),
        walletLocked: data.walletLocked.toString(),
        diffLocked: data.diffLocked.toString(),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Cancel an existing order and free up locked balances.
   */
  public async cancelOrder(
    orderId: string,
    market: string,
    clientId: string,
    userId: string
  ) {
    await EventStore.publishEvent({
      type: "ORDER_CANCEL",
      data: { orderId, market },
      timestamp: Date.now(),
    });
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
      const leftoverLocked = mulDiv(
        order.price, // 6-dec USDC
        order.quantity - order.filled, // 8-dec satoshis
        BTC_SCALE.toString() // 1e8
      );
      const userBalances = this.balance.get(order.userId);
      if (!userBalances) throw new Error(`User ${order.userId} not found`);
      await this.emitBalanceUnlock(order.userId, quoteAsset, leftoverLocked);
      this.sendUpdatedDepthAt(price.toString(), market);
    } else {
      // side = sell
      const price = cancelOrderbook.cancelAsk(order);
      if (!price) throw new Error("Order price not found");

      const leftoverLocked = order.quantity - order.filled;
      const userBalances = this.balance.get(order.userId);
      if (!userBalances) throw new Error(`User ${order.userId} not found`);
      await this.emitBalanceUnlock(order.userId, baseAsset, leftoverLocked);
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
  public async updateBalance(
    takerId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[]
  ) {
    for (const f of fills) {
      if (side === "buy") {
        // taker = buyer
        await this.emitTradeFill(
          takerId, // buyUserId
          f.makerUserId!, // sellUserId
          baseAsset,
          quoteAsset,
          f.price,
          f.quantity
        );
      } else {
        // taker = seller
        await this.emitTradeFill(
          f.makerUserId!, // buyUserId
          takerId, // sellUserId
          baseAsset,
          quoteAsset,
          f.price,
          f.quantity
        );
      }
    }
  }

  /**
   * Publish a BALANCE_UPDATE event for a user's current base & quote asset.
   * This ensures the DB eventually sees the updated in-memory balances.
   */
  private async publishBalanceUpdates(
    userId: string,
    baseAsset: string,
    quoteAsset: string
  ) {
    const userBalances = this.balance.get(userId);
    if (!userBalances) return;

    // Publish for baseAsset
    {
      const event: Event = {
        type: "BALANCE_UPDATE",
        data: {
          userId,
          asset: baseAsset,
          available: userBalances[baseAsset].available.toString(),
          locked: userBalances[baseAsset].locked.toString(),
        },
        timestamp: Date.now(),
      };
      await EventStore.publishEvent(event);
    }
    // Publish for quoteAsset
    {
      const event: Event = {
        type: "BALANCE_UPDATE",
        data: {
          userId,
          asset: quoteAsset,
          available: userBalances[quoteAsset].available.toString(),
          locked: userBalances[quoteAsset].locked.toString(),
        },
        timestamp: Date.now(),
      };
      await EventStore.publishEvent(event);
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

  async updateDbOrders(
    order: Order,
    executedQty: bigint,
    fills: Fill[],
    market: string
  ) {
    const orderUpdateEvent: Event = {
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
    await EventStore.publishEvent(orderUpdateEvent);

    // Also update the maker orders
    for (const fill of fills) {
      const fillUpdateEvent: Event = {
        type: "ORDER_UPDATE",
        data: {
          orderId: fill.makerOrderId!,
          executedQty: fill.quantity.toString(),
        },
        timestamp: Date.now(),
      };
      await EventStore.publishEvent(fillUpdateEvent);
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
      const wallet = this.balance.get(user.id);
      if (!wallet) {
        console.warn(`Reconcile: user ${user.id} is missing from RAM`);
        continue;
      }

      for (const asset of ["USDC", "BTC"] as const) {
        const ledgerAvail =
          asset === "USDC" ? BigInt(user.usdcBalance) : BigInt(user.btcBalance);

        const ledgerLocked =
          asset === "USDC" ? BigInt(user.usdcLocked) : BigInt(user.btcLocked);

        const memAvail = wallet[asset].available;
        const memLocked = wallet[asset].locked;

        const diffAvail = memAvail - ledgerAvail;
        const diffLocked = memLocked - ledgerLocked;

        if (diffAvail === 0n && diffLocked === 0n) continue; // no drift

        /* emit one event that describes both drifts */
        await this.emitBalanceMismatch({
          userId: user.id,
          asset,
          ledgerAvail,
          walletAvail: memAvail,
          diffAvail,
          ledgerLocked,
          walletLocked: memLocked,
          diffLocked,
        });

        const totalDrift = diffAvail + diffLocked;
        if (
          totalDrift > ALERT_THRESHOLD[asset] ||
          totalDrift < -ALERT_THRESHOLD[asset]
        ) {
          console.error(
            `[ALERT] drift ${totalDrift} ${asset} on user ${user.id}`
          );
        }
      }
    }
  }

  /**
   * Snapshot the entire orderbook for a single market and publish an event for DB.
   */
  public async snapshotOrderbook(market: string) {
    const ob = this.orderBooks.find((o) => o.ticker() === market);
    if (!ob) return;

    const json = JSON.stringify(ob.getSnapshot(), (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    );

    // write a tiny audit event just to bookmark the position
    const streamId = await EventStore.publishEvent({
      type: "ORDERBOOK_SNAPSHOT", // still useful for tracing
      data: { market }, // no giant blob
      timestamp: Date.now(),
    });

    await prisma.orderbookSnapshot.create({
      data: { market, snapshot: json, streamId, eventId: streamId },
    });

    /* Optional: keep only the 5 newest snapshots per market */
    await prisma.$executeRawUnsafe(
      `
      DELETE FROM "OrderbookSnapshot"
      WHERE id IN (
        SELECT id FROM "OrderbookSnapshot"
        WHERE market = $1
        ORDER BY "createdAt" DESC
        OFFSET 5
      );
    `,
      market
    );
    console.log(`Snapshot upserted for ${market} @ ${streamId}`);
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
  public async updateAndPublishTicker(fills: Fill[], market: string) {
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
    const payload = {
      snapshot: tickerAggregator.getTicker(market), // all the 24-h numbers
      history: tickerAggregator.getHistory(market), // the trade list
    };
    await RedisManager.getInstance().set(`ticker:${market}`, payload);
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
