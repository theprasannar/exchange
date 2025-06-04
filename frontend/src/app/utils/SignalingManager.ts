import { updateDepth } from "../store/depthSlice";
import store from "../store/store";

export const BASE_URL = "http://localhost:4001";

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
    this.ws.onopen = () => {
      //Send the message from buffer
      this.initialized = true;
      this.bufferedMessages.forEach((message) => {
        this.ws.send(JSON.stringify(message));
      });
      this.bufferedMessages = [];
    };
    // Handle incoming WebSocket messages
    this.ws.onmessage = (event) => {
      console.log("event", event);
      const message = JSON.parse(event.data);
      const type = message.type ?? message.data?.e;
      if (!type) {
        console.warn("No 'type' in WebSocket message:", message);
        return;
      }
      if (this.callbacks[type]) {
        this.callbacks[type].forEach(({ callback }) => {
          callback(message);
        });
      }
    };
    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    this.ws.onclose = () => {
      console.warn("WebSocket closed.");
    };
  }

  public onMessage(type: string, callback: (msg: any) => void) {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push(callback);
  }

  public sendMessage(message: any) {
    const messageToSend = {
      ...message,
      id: this.id++,
    };
    if (!this.initialized) {
      this.bufferedMessages.push(messageToSend);
      return;
    }
    this.ws.send(JSON.stringify(message));
  }
  public registerCallback(
    type: string,
    callback: (msg: any) => void,
    id: string
  ): void {
    if (!this.callbacks[type]) {
      this.callbacks[type] = [];
    }
    this.callbacks[type].push({ callback, id });
    console.log("all the callbacks", this.callbacks);
  }

  /**
   * Remove a previously registered callback for a specific type + ID.
   */
  public deRegisterCallback(type: string, id: string): void {
    if (this.callbacks[type]) {
      this.callbacks[type] = this.callbacks[type].filter(
        (item) => item.id !== id
      );
    }
  }
}
