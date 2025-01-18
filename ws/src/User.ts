import { IncomingMessage } from './types/WsInMessage';
import { OutgoingMessage } from './types/WsOutMessage';

import { WebSocket } from "ws";
import { SubscriptionManager } from './SubscriptionManager';

export class User {
    private id: string;
    private ws: WebSocket;
    private Subscription : string[] = [];

    public constructor(id : string, ws: WebSocket) {
        this.id = id;
        this.ws = ws;
        this.addListeners()
    }

    public subscribe(subscription: string) {
        this.Subscription.push(subscription)
    }

    public unSubscribe(subscription: string) {
        this.Subscription = this.Subscription.filter(s => s !== subscription)
    }

    emit(message : OutgoingMessage) {
        this.ws.send(JSON.stringify(message));
    }

    public addListeners() {
            this.ws.on("message", (message : string) => {
                const parsedMessage : IncomingMessage = JSON.parse(message)
                if(parsedMessage.method === "SUBSCRIBE") {
                    console.log(`User ${this.id} is SUBSCRIBING`)
                    parsedMessage.params.forEach(s => SubscriptionManager.getInstance().subscribe(this.id, s));
                } else if(parsedMessage.method === "UNSUBSCRIBE") {
                    parsedMessage.params.forEach(s => SubscriptionManager.getInstance().unsubscribe(this.id, parsedMessage.params[0]));
                }
            })
    }
}