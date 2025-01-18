import { updateDepth } from "../store/depthSlice";
import store from "../store/store";


export const BASE_URL = 'http://localhost:3001';

export class SignalingManager {
    private ws: WebSocket;
    private static instance: SignalingManager;
    private bufferedMessages: any[] = [];
    private initialized: boolean = false;
    private id: number;
    private callbacks: { [type: string]: any[] } = {};

    private constructor(signalingServerUrl?: string) {
        this.ws = new WebSocket(signalingServerUrl || BASE_URL);
        this.bufferedMessages = [];
        this.id = 1;
        this.init();
    }


    public static getInstance(): SignalingManager {
        if (!this.instance) {
            this.instance = new SignalingManager();
        }
        return this.instance;
    }

    public init() {

        const actionMap: Record<string, (payload: any) => void> = {
            DEPTH: (payload) => store.dispatch(updateDepth(payload)),
        };

        this.ws.onopen = () => {
            //Send the message from buffer
            this.initialized = true;
            this.bufferedMessages.forEach(message => {
                this.ws.send(JSON.stringify(message));
            });
            this.bufferedMessages = [];
        }
        // Handle incoming WebSocket messages
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            const handler = actionMap[msg.type]; // Find the appropriate handler
            if (handler) {
                handler(msg.payload); // Dispatch the Redux action
            } else {
                console.warn(`Unhandled WebSocket message type: ${msg.type}`);
            }
        };
    }

    public onMessage(type: string, callback: (msg: any) => void) {
        if (!this.callbacks[type]) {
            this.callbacks[type] = []; // Initialize callback array for the type
        }
        this.callbacks[type].push(callback); // Add the callback
    }
    
    public sendMessage(message: any) {
        const messageToSend = {
            ...message,
            id: this.id++
        }
        if (!this.initialized) {
            this.bufferedMessages.push(messageToSend);
            return;
        }
        this.ws.send(JSON.stringify(message));
    }
}

