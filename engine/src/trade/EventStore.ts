import { RedisManager } from "../redisManager";

export interface Event {
  id?: string;
  type: string; // Event type (e.g., "ORDER_CREATE", "BALANCE_UPDATE", etc.)
  data: any;
  timestamp: number;
  retryCount?: number;
}

/**
 * EventStore:
 * - Encapsulates publishing events to a durable message queue.
 */

const SIDEFX = new Set(["BALANCE_MISMATCH", "TICKER_UPDATE"]);

export class EventStore {
  static async publishEvent(event: Event): Promise<string> {
    try {
      /* 1️⃣  decide which stream to write to */
      const streamName = SIDEFX.has(event.type) ? "sidefx" : "events";

      /* 2️⃣  add the JSON blob to the stream */
      const redisId = await RedisManager.getInstance().xAdd(
        streamName,
        "*",
        JSON.stringify(event)
      );

      event.id = `${streamName}:${redisId}`;

      console.log(
        `EventStore: published ${event.type} ${event.id} (stream ${streamName})`
      );

      return event.id;
    } catch (error) {
      console.error("EventStore: Failed to publish event", event.id, error);
      throw error;
    }
  }
}
