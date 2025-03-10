import { RedisManager } from "../redisManager";

export interface Event {
    id: string;
    type: string;   // Event type (e.g., "ORDER_CREATE", "BALANCE_UPDATE", etc.)
    data: any;
    timestamp: number;
    retryCount?: number;
}

/**
 * EventStore:
 * - Encapsulates publishing events to a durable message queue.
 */
export class EventStore {

    static async publishEvent(event: Event): Promise<void> {
        try {
            await RedisManager.getInstance().pushEvent('event_store', JSON.stringify(event));
            console.log(`EventStore: Published event ${event.id} of type ${event.type}`);
        } catch (error) {
            console.error("EventStore: Failed to publish event", event.id, error);
        }
    }
}