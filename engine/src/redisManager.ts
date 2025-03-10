import { createClient, RedisClientType } from 'redis';
import { DbMessage } from './types/MessageToDatabase';
import { MessageToAPI } from './types/MessageToAPI';
import { WsMessage } from './types/MessageToWs';

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
    this.publisherClient.lPush('db_processor', JSON.stringify(message));
  }

  public async getZRangeByScore(key: string, min: string, max: string): Promise<string[]> {
    return await this.publisherClient.zRangeByScore(key, min, max);
  }

  public async pushEvent(key: string, value: string): Promise<void> {
    await this.publisherClient.lPush(key, value);
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
