import { createClient, RedisClientType } from 'redis';
import { MessageToEngine } from './types/messageToEngineTypes';


export class RedisManager {
    private client: RedisClientType;
    private publisher: RedisClientType;
    private static instance: RedisManager;

    public constructor() {
        this.client = createClient();
        this.publisher = createClient();

        this.client.on('error', (error) => console.error('Redis Subscriber error', error));
        this.publisher.on('error', (error) => console.error('Redis Publisher error', error));

        Promise.all([this.client.connect(), this.publisher.connect()])
            .catch((err) => console.error('Failed to connect Redis clients:', err));
    }

    public static getInstance(): RedisManager {
        //If there is not instance of redis create one 
        if (!this.instance) {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

  public sendAndAwait(message: MessageToEngine, timeOutMS = 5000) {
    return new Promise((resolve, reject) => {
        let clientId = this.generateRandomClientId();

        // Development mode: Disable timeout if timeOutMS is set to 0
        const timer = timeOutMS > 0 ? setTimeout(() => {
            this.client.unsubscribe(clientId);
            reject(new Error('Timed out waiting for response on channel ' + clientId));
        }, timeOutMS) : null;
        this.client.subscribe(clientId, async (message) => {
            console.log("Received message in subscribe callback:", message);
            let parsedMessage: any;
            try {
              parsedMessage = JSON.parse(message);
              console.log("Parsed Message:", parsedMessage);
            } catch (error) {
              console.error(`Error parsing message from ${clientId}:`, message);
              return;
            }
            
            // Only process the message if it contains the expected properties
            if (!parsedMessage || !parsedMessage.payload || Object.keys(parsedMessage.payload).length === 0) {
              console.log("Ignoring incomplete message:", parsedMessage);
              return; // wait for the correct message
            }
            
            if (timer) clearTimeout(timer);
            
            try {
              await this.client.unsubscribe(clientId);
              console.log(`Unsubscribed from ${clientId}`);
            } catch (error) {
              console.error(`Error unsubscribing from ${clientId}:`, error);
            }
            
            resolve(parsedMessage);
          }).catch(error => {
            if (timer) clearTimeout(timer);
            console.error(`Failed to subscribe to ${clientId}:`, error);
            reject(error);
          });
          

        this.publisher.lPush('message', JSON.stringify({
            clientId: clientId,
            message: message
        })).catch(publishErr => {
            if (timer) clearTimeout(timer);
            console.error("Failed to enqueue request message:", publishErr);
            this.client.unsubscribe(clientId).catch(() => {});
            reject(publishErr);
        });
    });
}

    private generateRandomClientId() {
        return Math.random().toString(36).substring(0, 12) + Math.random().toString(36).substring(0, 12);
    }

    public async setUserBalance(userId: string, balance: any): Promise<void> {
        await this.client.set(`balance:${userId}`, JSON.stringify(balance));
    }

    

}