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

  private constructor() {
    // Create both clients
    this.publisherClient = createClient();
    this.subscriberClient = createClient();

    // Connect both
    this.publisherClient.connect();
    this.subscriberClient.connect();
  }

  // Singleton pattern
  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private static toJson(value: any): string {
    return JSON.stringify(value, (_, v) =>
      typeof v === "bigint" ? v.toString() : v
    );
  }
  /**
   * ============ PUBLISH METHODS ============
   * You can do any typical Redis operation on the "publisherClient".
   * For example, publishing events or pushing items to a queue.
   */
  public publishMessage(channel: string, message: WsMessage | any) {
    // Use publisher client
    this.publisherClient.publish(channel, JSON.stringify(message));
  }

  public sendToApi(clientId: string, message: MessageToAPI) {
    // Use publisher client
    this.publisherClient.publish(clientId, JSON.stringify(message));
  }

  public pushMessage(message: DbMessage) {
    // Use publisher client
    this.publisherClient.lPush("db_processor", JSON.stringify(message));
  }

  public async xAck(
    stream: string,
    group: string,
    id: string
  ): Promise<number> {
    // delegate to the underlying Redis client
    return this.publisherClient.xAck(stream, group, id);
  }
  // redisManager.ts
  public async xAdd(
    stream: string,
    id: string, // "*" or explicit id
    json: string,
    maxLen = 10_000_000
  ) {
    return this.publisherClient.xAdd(
      stream,
      id,
      { json },
      { TRIM: { strategy: "MAXLEN", threshold: maxLen } }
    );
  }

  public async set(key: string, value: any) {
    await this.publisherClient.set(key, RedisManager.toJson(value));
  }

  public async get(key: string) {
    return await this.publisherClient.get(key);
  }

  // inside RedisManager
  /**
   * Create a consumer group on a stream.
   */
  public async xGroupCreate(params: {
    key: string; // stream name
    group: string; // consumer-group name
    id: string; // "0", "$", etc.
    MKSTREAM?: boolean; // auto-create stream if missing
  }): Promise<string> {
    const { key, group, id, MKSTREAM } = params;
    return this.publisherClient.xGroupCreate(
      key,
      group,
      id,
      MKSTREAM ? { MKSTREAM } : undefined
    );
  }

  /**
   * Read from a stream via XREADGROUP.
   */
  public async xReadGroup(
    group: string,
    consumer: string,
    stream: { key: string; id: string },
    opts: { COUNT?: number; BLOCK?: number }
  ): Promise<Array<{
    name: string;
    messages: Array<{ id: string; message: Record<string, string> }>;
  }> | null> {
    // ← allow the “no messages” case
    // Redis v4 expects an array of streams: [{ key, id }]
    return this.publisherClient.xReadGroup(
      group,
      consumer,
      [stream], // wrap in array
      opts
    );
  }

  public async xRead(
    streams: Array<{ key: string; id: string }>,
    opts: { COUNT?: number; BLOCK?: number }
  ): Promise<Array<{
    name: string;
    messages: Array<{ id: string; message: Record<string, string> }>;
  }> | null> {
    return await this.publisherClient.xRead(streams, opts);
  }
  /**
   * ============ SUBSCRIBE METHOD ============
   * This puts the "subscriberClient" into subscriber mode for the given channel.
   * Once in subscriber mode, that client CANNOT perform other ops like publish.
   */
  public subscribe(channel: string, onMessage: (message: string) => void) {
    // Use subscriber client
    this.subscriberClient.subscribe(channel, (rawMessage) => {
      onMessage(rawMessage);
    });
  }
}
