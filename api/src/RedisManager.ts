import { createClient, RedisClientType } from "redis";
import { MessageToEngine } from "./types/messageToEngineTypes";

const ORDERS_STREAM = process.env.ORDERS_STREAM ?? "orders";

export class RedisManager {
  private client: RedisClientType;
  private publisher: RedisClientType;
  private static instance: RedisManager;

  private constructor() {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    this.client = createClient({ url });
    this.publisher = createClient({ url });

    this.client.on("error", (e) => console.error("Redis subscriber error:", e));
    this.publisher.on("error", (e) =>
      console.error("Redis publisher error:", e)
    );

    Promise.all([this.client.connect(), this.publisher.connect()]).catch((e) =>
      console.error("Failed to connect Redis clients:", e)
    );
  }

  public static getInstance(): RedisManager {
    if (!this.instance) this.instance = new RedisManager();
    return this.instance;
  }

  /** Send a request to the engine and wait for a Pub/Sub reply */
  public sendAndAwait(
    message: MessageToEngine,
    timeoutMs = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
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
    await this.client.set(`balance:${userId}`, JSON.stringify(balance));
  }
}
