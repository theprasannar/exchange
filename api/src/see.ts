import { Engine } from "../../engine/src/trade/engine";

// Initialize engine instance
const engine = new Engine();

console.log("Seeding the order book with initial dummy orders...");

// ✅ Step 1: Add pre-existing sell (ask) orders
engine.createOrder("BTC_INR", "0.5", "5000000", "sell", "user1");  // User1 selling 0.5 BTC at ₹50,000
engine.createOrder("BTC_INR", "0.3", "5100000", "sell", "user2");  // User2 selling 0.3 BTC at ₹51,000

// ✅ Step 2: Add pre-existing buy (bid) orders
engine.createOrder("BTC_INR", "0.2", "4800000", "buy", "user3");  // User3 buying 0.2 BTC at ₹48,000
engine.createOrder("BTC_INR", "0.4", "4700000", "buy", "user4");  // User4 buying 0.4 BTC at ₹47,000

console.log("Order book seeded. Ready to place test orders.");
