import { createClient, RedisClientType } from "redis";
import { UserManager } from "./UserManager";

export class SubscriptionManager {
    private static instance: SubscriptionManager;
    private subscriptions: Map<string, string[]> = new Map();
    private reverseSubscriptions: Map<string, string[]> = new Map();
    private redisClient: RedisClientType;

    public constructor() {
        this.redisClient = createClient();
        this.redisClient.connect();

    }

    public static getInstance() {
        if (!this.instance)  {
            this.instance = new SubscriptionManager();
        }
        return this.instance;
    }

    public subscribe(userId: string, subscription: string) {
        if(this.subscriptions.get(userId)?.includes(userId)) {
            return;
        }
        this.subscriptions.set(userId, (this.subscriptions.get(userId) || []).concat(subscription));
        this.reverseSubscriptions.set(subscription, (this.reverseSubscriptions.get(subscription) || []).concat(userId));

        if(this.reverseSubscriptions.get(subscription)?.length === 1) {
            this.redisClient.subscribe(subscription, this.redisCallBackHandler);
        }
    }

    public unsubscribe(userId: string, subscription: string) {
        let subscriptions = this.subscriptions.get(userId);
        if(!subscriptions) {
            return;
        }
            // Remove the specified subscription from the user's list
        this.subscriptions.set(userId, subscriptions.filter(s => s !== subscription));

        let reverseSubscriptions = this.reverseSubscriptions.get(subscription);
        if(reverseSubscriptions) {
                    // Remove the user from the subscription's user list
            this.reverseSubscriptions.set(subscription, reverseSubscriptions.filter(u => u !== userId));

            if(this.reverseSubscriptions.get(subscription)?.length === 0) {
                this.reverseSubscriptions.delete(subscription);
                this.redisClient.unsubscribe(subscription);
            }
        }
        
    }
    
    public redisCallBackHandler(message: string, channel: string) {
        this.reverseSubscriptions.get(channel)?.forEach(userId => {UserManager.getInstance().getUser(userId)?.emit(JSON.parse(message))});
    }

}