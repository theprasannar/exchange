import { createClient, RedisClientType } from "redis";
import { DbMessage } from "./types/MessageToDatabase";
import { MessageToAPI } from "./types/MessageToAPI";
import { WsMessage } from "./types/MessageToWs";

export class RedisManager {
  private static instance: RedisManager;

  // 1) Publisher client for publish + general commands
  private publisherClient: RedisClientType;
  // 2) Subscriber client for subscribing only
  private subscriberClient: RedisClientType;

  // *** NEW *** track when both clients are connected
  private ready: Promise<void>;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"; // fallback for local dev

    // Create both clients with the URL and retry strategy
    const retryStrategy = (retries: number) => {
      if (retries > 10) {
        console.error('Redis: Max retries reached, giving up');
        return new Error('Redis max retries reached');
      }
      const delay = Math.min(retries * 100, 3000);
      console.log(`Redis: Reconnecting in ${delay}ms (attempt ${retries})...`);
      return delay;
    };

    this.publisherClient = createClient({ 
      url: redisUrl,
      socket: { reconnectStrategy: retryStrategy }
    });
    this.subscriberClient = createClient({ 
      url: redisUrl,
      socket: { reconnectStrategy: retryStrategy }
    });

    // Error handling for Redis clients
    this.publisherClient.on('error', (err) => console.error('Redis publisher error:', err.message));
    this.subscriberClient.on('error', (err) => console.error('Redis subscriber error:', err.message));
    this.publisherClient.on('reconnecting', () => console.log('Redis publisher reconnecting...'));
    this.subscriberClient.on('reconnecting', () => console.log('Redis subscriber reconnecting...'));

    // *** NEW *** connect and keep the promise
    this.ready = Promise.all([
      this.publisherClient.connect(),
      this.subscriberClient.connect(),
    ]).then(() => {
      console.log('✅ Engine RedisManager: Both clients connected');
    });
  }

  // Singleton pattern
  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private async ensureReady() {
    await this.ready; // *** NEW ***
  }

  private static toJson(value: any): string {
    return JSON.stringify(value, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    );
  }

  /**
   * ============ PUBLISH METHODS ============
   */
  public async publishMessage(channel: string, message: WsMessage | any) {
    await this.ensureReady(); // *** NEW ***
    this.publisherClient.publish(channel, JSON.stringify(message));
  }

  public async sendToApi(clientId: string, message: MessageToAPI) {
    await this.ensureReady(); // *** NEW ***
    this.publisherClient.publish(clientId, JSON.stringify(message));
  }

  public async xAck(
    stream: string,
    group: string,
    id: string
  ): Promise<number> {
    await this.ensureReady(); // *** NEW ***
    return this.publisherClient.xAck(stream, group, id);
  }

  public async xAdd(
    stream: string,
    id: string, // "*" or explicit id
    json: string,
    maxLen = 10_000_000
  ) {
    await this.ensureReady(); // *** NEW ***
    return this.publisherClient.xAdd(
      stream,
      id,
      { json },
      { TRIM: { strategy: "MAXLEN", threshold: maxLen } }
    );
  }

  public async set(key: string, value: any) {
    await this.ensureReady(); // *** NEW ***
    await this.publisherClient.set(key, RedisManager.toJson(value));
  }

  public async get(key: string) {
    await this.ensureReady(); // *** NEW ***
    return this.publisherClient.get(key);
  }

  /**
   * ============ STREAM HELPERS ============
   */
  public async xGroupCreate(params: {
    key: string;
    group: string;
    id: string;
    MKSTREAM?: boolean;
  }): Promise<string> {
    await this.ensureReady(); // *** NEW ***
    const { key, group, id, MKSTREAM } = params;
    return this.publisherClient.xGroupCreate(
      key,
      group,
      id,
      MKSTREAM ? { MKSTREAM } : undefined
    );
  }

  public async xReadGroup(
    group: string,
    consumer: string,
    stream: { key: string; id: string },
    opts: { COUNT?: number; BLOCK?: number }
  ): Promise<Array<{
    name: string;
    messages: Array<{ id: string; message: Record<string, string> }>;
  }> | null> {
    await this.ensureReady(); // *** NEW ***
    return this.publisherClient.xReadGroup(group, consumer, [stream], opts);
  }

  public async xRead(
    streams: Array<{ key: string; id: string }>,
    opts: { COUNT?: number; BLOCK?: number }
  ): Promise<Array<{
    name: string;
    messages: Array<{ id: string; message: Record<string, string> }>;
  }> | null> {
    await this.ensureReady(); // *** NEW ***
    return this.publisherClient.xRead(streams, opts);
  }

  /**
   * ============ STREAM INFO ============
   */

  /**
   * Get information about a stream including length, first/last entry, etc.
   */
  public async xInfoStream(stream: string): Promise<any> {
    await this.ensureReady();
    return this.publisherClient.xInfoStream(stream);
  }

  /**
   * Get information about all consumer groups for a stream.
   */
  public async xInfoGroups(stream: string): Promise<any[]> {
    await this.ensureReady();
    return this.publisherClient.xInfoGroups(stream);
  }

  /**
   * Get detailed pending message information for a consumer group.
   */
  public async xPendingRange(
    stream: string,
    group: string,
    start: string,
    end: string,
    count: number
  ): Promise<any[]> {
    await this.ensureReady();
    return this.publisherClient.xPendingRange(stream, group, start, end, count);
  }

  /**
   * Claim ownership of pending messages that have been idle for too long.
   * This is used to recover messages from crashed consumers.
   */
  public async xClaim(
    stream: string,
    group: string,
    consumer: string,
    minIdleTime: number,
    ids: string[]
  ): Promise<any[]> {
    await this.ensureReady();
    return this.publisherClient.xClaim(stream, group, consumer, minIdleTime, ids);
  }

  /**
   * Safe trim that respects consumer group progress.
   * Only trims messages that have been processed by all consumer groups.
   * This prevents data loss from aggressive MAXLEN trimming.
   */
  public async safeTrim(stream: string, maxLen: number): Promise<number> {
    await this.ensureReady();

    try {
      // Get all consumer groups for this stream
      const groups = await this.publisherClient.xInfoGroups(stream);
      if (groups.length === 0) {
        // No consumer groups, safe to trim by length
        return this.publisherClient.xTrim(stream, "MAXLEN", maxLen);
      }

      // Find the lowest ID that is SAFE to trim up to.
      // We must consider both lastDeliveredId AND the oldest pending (un-ACKed) message.
      // Using only lastDeliveredId is wrong: it marks last *delivered*, not last *acknowledged*.
      let minId: string | null = null;

      for (const group of groups) {
        // Check for unacknowledged messages first — these MUST NOT be trimmed
        if (group.pending > 0) {
          try {
            const pending = await this.publisherClient.xPendingRange(
              stream, group.name, "-", "+", 1
            );
            if (pending.length > 0) {
              const oldestPending = pending[0].id;
              if (!minId || this.compareStreamIds(oldestPending, minId) < 0) {
                minId = oldestPending;
              }
              continue; // oldest pending is the true safe boundary for this group
            }
          } catch {
            // If XPENDING fails, fall back to lastDeliveredId
          }
        }

        // No pending messages — lastDeliveredId is the safe boundary
        const lastDeliveredId = group.lastDeliveredId;
        if (lastDeliveredId === "0-0") continue;

        if (!minId || this.compareStreamIds(lastDeliveredId, minId) < 0) {
          minId = lastDeliveredId;
        }
      }

      if (minId && minId !== "0-0") {
        // Only trim messages older than the oldest unprocessed entry
        const timestamp = parseInt(minId.split("-")[0], 10);
        return this.publisherClient.xTrim(stream, "MINID", timestamp);
      }

      return 0;
    } catch (e: any) {
      if (e.message?.includes("no such key")) {
        return 0; // Stream doesn't exist yet
      }
      throw e;
    }
  }

  /**
   * Compare two Redis stream IDs.
   * Returns negative if a < b, positive if a > b, 0 if equal.
   */
  private compareStreamIds(a: string, b: string): number {
    const [aMs, aSeq] = a.split("-").map(Number);
    const [bMs, bSeq] = b.split("-").map(Number);

    if (aMs !== bMs) return aMs - bMs;
    return aSeq - bSeq;
  }

  /**
   * ============ SUBSCRIBE ============
   */
  public subscribe(channel: string, onMessage: (message: string) => void) {
    this.ready.then(() => {
      this.subscriberClient.subscribe(channel, (rawMessage) => {
        onMessage(rawMessage);
      });
    });
  }
}
