import "dotenv/config";
import * as http from "http";
import { WebSocketServer } from "ws";
import { UserManager } from "./UserManager";

// Unhandled promise rejection handler — crash to avoid running in a corrupt state
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const PORT = 4001;

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

wss.on("error", (err) => {
  console.error("WebSocket server error:", err);
});

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 WS Server: Received ${signal}, shutting down gracefully...`);
  
  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    client.close(1001, 'Server shutting down');
  });
  
  // Close the server
  wss.close(() => {
    server.close(() => {
      console.log('👋 WS Server: Shutdown complete');
      process.exit(0);
    });
  });
  
  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('WS Server: Force shutdown after timeout');
    process.exit(0);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
