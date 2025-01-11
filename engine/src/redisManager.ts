import { DbMessage } from './MessageToDatabase';
import { MessageToAPI } from './types/MessageToAPI';
import { createClient, RedisClientType } from 'redis';
import { WsMessage } from './types/MessageToWs';

export class RedisManager {
    private client : RedisClientType;
    private static instance: RedisManager;


    constructor() {
        this.client = createClient();
        this.client.connect();

    }

    public static getInstance() {
        if(!this.instance) {
            this.instance = new RedisManager();
        }
        return this.instance;
    }

    public sendToApi(clientId : string, message: MessageToAPI) {
        this.client.publish(clientId, JSON.stringify(message));
    }

    public pushMessage(message: DbMessage) {
        this.client.lPush("db_processor", JSON.stringify(message));
    }

    public publishMessage(channel: string, message: WsMessage) {
        this.client.publish(channel, JSON.stringify(message));
    }
    
}