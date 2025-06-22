import { RedisManager } from "../redisManager";

export interface Event {
  id: string;
  type: string; // Event type (e.g., "ORDER_CREATE", "BALANCE_UPDATE", etc.)
  data: any;
  timestamp: number;
  retryCount?: number;
}

/**
 * EventStore:
 * - Encapsulates publishing events to a durable message queue.
 */

const STREAM_KEY = "events";
const MAX_LEN = 10_000_000;

export class EventStore {
  static async publishEvent(event: Event): Promise<string> {
    try {
      const json = JSON.stringify(event);
      const redis = RedisManager.getInstance();

      // 1) legacy list write
      await redis.pushEvent("event_store", json);

      // 2) stream write
      const id = await redis.xAdd(STREAM_KEY, json, MAX_LEN);

      console.log(
        `EventStore: published ${event.type} ${event.id} ` +
          `(list + stream id ${id})`
      );
      return id; // ← always returns on success
    } catch (error) {
      console.error("EventStore: Failed to publish event", event.id, error);
      throw error;
    }
  }
}
