import { createClient, RedisClientType } from "redis";
import { MessageToEngine } from "./types/messageToEngineTypes";

const ORDERS_STREAM = process.env.ORDERS_STREAM ?? "orders";

export class RedisManager {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private static instance: RedisManager;
  private ready: Promise<void>;

  private constructor() {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    const retryStrategy = (retries: number) => {
      if (retries > 10) {
        console.error('API Redis: Max retries reached');
        return new Error('Redis max retries reached');
      }
      const delay = Math.min(retries * 100, 3000);
      console.log(`API Redis: Reconnecting in ${delay}ms (attempt ${retries})...`);
      return delay;
    };

    this.client = createClient({ url, socket: { reconnectStrategy: retryStrategy } });
    this.publisher = createClient({ url, socket: { reconnectStrategy: retryStrategy } });

    this.client.on("error", (e) => console.error("Redis subscriber error:", e));
    this.publisher.on("error", (e) =>
      console.error("Redis publisher error:", e)
    );

    this.ready = Promise.all([this.client.connect(), this.publisher.connect()])
      .then(() => { console.log('✅ API RedisManager: Both clients connected'); })
      .catch((e) => console.error("Failed to connect Redis clients:", e));
  }

  public static getInstance(): RedisManager {
    if (!this.instance) this.instance = new RedisManager();
    return this.instance;
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  /** 
   * Send a request to the engine and wait for a Pub/Sub reply.
   * 
   * @param message - The message to send to the engine
   * @param timeoutMs - Timeout in milliseconds (default 5000)
   * @param idempotencyKey - Optional client-provided idempotency key to prevent duplicate orders
   */
  public sendAndAwait(
    message: MessageToEngine,
    timeoutMs = 5000
  ): Promise<any> {
    return new Promise(async (resolve, reject) => {
      await this.ensureReady();
      
      const clientId = this.generateRandomClientId();

      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              this.client.unsubscribe(clientId).catch(() => {});
              reject(
                new Error("Timed out waiting for response on " + clientId)
              );
            }, timeoutMs)
          : null;

      // --- subscribe for the one‑off reply -------------------------------
      this.client
        .subscribe(clientId, async (raw) => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            console.error(`Invalid JSON on channel ${clientId}:`, raw);
            return;
          }

          if (!parsed || !("payload" in parsed)) return; // ignore noise
          if (timer) clearTimeout(timer);

          await this.client.unsubscribe(clientId).catch(() => {});
          resolve(parsed);
        })
        .catch((e) => {
          if (timer) clearTimeout(timer);
          reject(e);
        });

      // --- enqueue request to the durable stream -------------------------
      this.publisher
        .xAdd(ORDERS_STREAM, "*", {
          json: JSON.stringify({ clientId, message }),
        } as Record<string, string>)
        .catch((e) => {
          if (timer) clearTimeout(timer);
          this.client.unsubscribe(clientId).catch(() => {});
          reject(e);
        });
    });
  }

  private generateRandomClientId(): string {
    return (
      Math.random().toString(36).substring(2, 14) +
      Math.random().toString(36).substring(2, 14)
    );
  }

  public async setUserBalance(userId: string, balance: any): Promise<void> {
    await this.ensureReady();
    await this.client.set(`balance:${userId}`, JSON.stringify(balance));
  }

  /**
   * Check if Redis clients are connected and healthy.
   * Useful for health check endpoints.
   */
  /**
   * Attempt to claim an idempotency key. Returns the cached response if the key
   * was already used, or null if this is the first time (key is now reserved).
   * Uses Redis SET NX with a 5-minute TTL.
   */
  public async claimIdempotencyKey(key: string): Promise<string | null> {
    await this.ensureReady();
    // SET NX returns true only if the key did NOT already exist
    const claimed = await this.publisher.set(
      `idempotency:${key}`,
      "pending",
      { NX: true, EX: 300 } // 5 minute TTL
    );
    if (claimed) return null; // first time — proceed
    // Key already exists — return cached response
    return this.publisher.get(`idempotency:${key}`);
  }

  /**
   * Store the response for an idempotency key so subsequent retries
   * get the same response.
   */
  public async setIdempotencyResponse(key: string, response: string): Promise<void> {
    await this.ensureReady();
    // Update the value but keep the same TTL (5 minutes)
    await this.publisher.set(`idempotency:${key}`, response, { EX: 300 });
  }

  /**
   * Delete an idempotency key (e.g., on order failure so the user can retry).
   */
  public async deleteIdempotencyKey(key: string): Promise<void> {
    await this.ensureReady();
    await this.publisher.del(`idempotency:${key}`);
  }

  public async isHealthy(): Promise<boolean> {
    try {
      await this.ensureReady();
      await Promise.all([this.publisher.ping(), this.client.ping()]);
      return true;
    } catch {
      return false;
    }
  }
}
