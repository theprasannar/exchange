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

    // Create both clients with the URL
    this.publisherClient = createClient({ url: redisUrl });
    this.subscriberClient = createClient({ url: redisUrl });

    // *** NEW *** connect and keep the promise
    this.ready = Promise.all([
      this.publisherClient.connect(),
      this.subscriberClient.connect(),
    ]).then(() => {});
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
