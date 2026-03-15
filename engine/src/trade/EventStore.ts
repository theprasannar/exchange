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
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_DELAY_MS = 100;

  /**
   * Publish an event to Redis stream with retry logic for transient failures.
   * Uses exponential backoff to avoid overwhelming Redis during issues.
   */
  static async publishEvent(event: Event): Promise<string> {
    /* 1️⃣  decide which stream to write to */
    const streamName = SIDEFX.has(event.type) ? "sidefx" : "events";
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
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
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on non-transient errors
        if (lastError.message.includes('WRONGTYPE') || 
            lastError.message.includes('OOM')) {
          console.error("EventStore: Non-retryable error", event.type, lastError.message);
          throw lastError;
        }
        
        if (attempt < this.MAX_RETRIES) {
          const delay = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`EventStore: Retry ${attempt}/${this.MAX_RETRIES} for ${event.type} in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    console.error("EventStore: Failed to publish event after retries", event.type, lastError);
    throw lastError;
  }
}
