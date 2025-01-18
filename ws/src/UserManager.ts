import { WebSocket} from 'ws'
import {uid} from 'uid'
import { User } from './User';

export class UserManager {
    
    private static instance: UserManager;
    private users: Map<string, User> = new Map();

    private constructor() {}

    public static getInstance() : UserManager {
        if(!this.instance) {
            this.instance = new UserManager();
        }
        return this.instance;
    }

    public addUser(ws : WebSocket) {
        let id = this.generateUniqueId();
        const user = new User(id, ws);
        this.registerOnClose(ws , id);
        this.users.set(id, user);
    }

    public registerOnClose(ws : WebSocket, id : string) {
        ws.on("close", () => {
            this.users.delete(id);
        })
        
    }

    public getUser(id: string) {
        return this.users.get(id);
    }
    
    public generateUniqueId() {
        return uid(32); 
    }
}

