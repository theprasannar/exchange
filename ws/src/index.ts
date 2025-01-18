import * as http from "http";
import { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";

const PORT = 3001;

const server = http.createServer();


const wss = new WebSocketServer({ server });

server.listen(PORT, () => {
  console.log(`HTTP + WS Server is now listening on port ${PORT}`);
});

// Handle new WebSocket connections
wss.on("connection", (ws) => {
  console.log("New client connected via WebSocket!");
  UserManager.getInstance().addUser(ws);
});
