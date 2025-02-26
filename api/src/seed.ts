// import axios from "axios";

// // URL for your createOrder API endpoint:
// const API_BASE_URL = "http://localhost:4000/api/v1/orders";

// // Define the order data interface using display values.
// // For USDC, price is in USDC (e.g. "50.5" means 50.5 USDC).
// // For BTC, quantity is in BTC (e.g. "0.5" means 0.5 BTC).
// interface OrderData {
//   market: string;
//   price: string;      // Display USDC value (not atomic)
//   quantity: string;   // Display BTC value (not atomic)
//   side: "buy" | "sell";
//   userId: string;
// }

// /*
//   Fixed seed dataset for market "BTC_USDC" with 5 sell orders and 5 buy orders.
  
//   Sell orders (asks):
//     - Prices: 50.5, 50.6, 50.7, 50.8, 50.9 USDC
//     - Quantity: 0.5 BTC each
  
//   Buy orders (bids):
//     - Prices: 49.1, 49.2, 49.3, 49.4, 49.5 USDC
//     - Quantity: 0.5 BTC each
  
//   Since the highest buy (49.5 USDC) is lower than the lowest sell (50.5 USDC),
//   no matching occurs and the order book should remain with 5 asks and 5 bids.
// */
// const orders: OrderData[] = [
//   // Sell orders:
//   { market: "BTC_USDC", price: "50.5", quantity: "0.5", side: "sell", userId: "user1" },
//   { market: "BTC_USDC", price: "50.6", quantity: "0.5", side: "sell", userId: "user2" },
//   { market: "BTC_USDC", price: "50.7", quantity: "0.5", side: "sell", userId: "user3" },
//   { market: "BTC_USDC", price: "50.8", quantity: "0.5", side: "sell", userId: "user4" },
//   { market: "BTC_USDC", price: "50.9", quantity: "0.5", side: "sell", userId: "user5" },

//   // Buy orders:
//   { market: "BTC_USDC", price: "49.1", quantity: "0.5", side: "buy", userId: "user6" },
//   { market: "BTC_USDC", price: "49.2", quantity: "0.5", side: "buy", userId: "user7" },
//   { market: "BTC_USDC", price: "49.3", quantity: "0.5", side: "buy", userId: "user8" },
//   { market: "BTC_USDC", price: "49.4", quantity: "0.5", side: "buy", userId: "user9" },
//   { market: "BTC_USDC", price: "49.5", quantity: "0.5", side: "buy", userId: "user10" },
// ];

// async function sendOrder(order: OrderData) {
//   try {
//     const response = await axios.post(API_BASE_URL, order);
//     console.log(`[${new Date().toISOString()}] Order placed:`, response.data);
//   } catch (error: any) {
//     console.log(error)
//     console.error(
//       `[${new Date().toISOString()}] Error placing order:`,
//       error.response?.data || error.message
//     );
//   }
// }

// async function seedFixedOrders() {
//   for (const order of orders) {
//     await sendOrder(order);
//     // Delay 500ms between orders so they are sent sequentially
//     await new Promise(resolve => setTimeout(resolve, 500));
//   }
//   console.log("Fixed seed orders (5 sell and 5 buy) have been sent.");
// }

// seedFixedOrders();


import axios from "axios";

// API endpoint where orders are created (ensure this is correct)
const API_BASE_URL = "http://localhost:4000/api/v1/orders";

// Users placing orders
const USERS = ["user1", "user2", "user3", "user4", "user5", "user6", "user7", "user8", "user9", "user10"];

// Define the order data structure
interface OrderData {
  market: string;
  price: string;
  quantity: string;
  side: "buy" | "sell";
  userId: string;
}

// Function to generate random prices within a range
function getRandomPrice(basePrice: number, spread: number) {
  return (basePrice + (Math.random() - 0.5) * spread).toFixed(2);
}

// Function to generate random quantities
function getRandomQuantity(min: number, max: number) {
  return (Math.random() * (max - min) + min).toFixed(4);
}

// Function to create randomized orders
function generateOrders(): OrderData[] {
  const orders: OrderData[] = [];
  const basePrice = 50000; // Base BTC price (50k USDC)
  const spread = 200; // Max deviation in price

  for (let i = 0; i < 10; i++) {
    const side: "buy" | "sell" = i % 2 === 0 ? "buy" : "sell"; // Alternate buy/sell
    orders.push({
      market: "BTC_USDC",
      price: getRandomPrice(basePrice, spread),
      quantity: getRandomQuantity(0.01, 0.5), // Random quantity between 0.01 and 0.5 BTC
      side,
      userId: USERS[i % USERS.length], // Rotate through users
    });
  }

  return orders;
}

// Function to send order requests
async function sendOrder(order: OrderData) {
  try {
    const response = await axios.post(API_BASE_URL, order);
    console.log(`[${new Date().toISOString()}] Order placed:`, response.data);
  } catch (error: any) {
    console.log("sendOrder ~ error:", error)
    console.error(
      `[${new Date().toISOString()}] Error placing order:`,
      error.response?.data || error.message
    );
  }
}

// Seed function that creates orders with a delay to simulate real trading
async function seedOrders() {
  console.log("🚀 Seeding orders for 1-minute and 5-minute kline testing...");

  for (let i = 0; i < 10; i++) {
    const orders = generateOrders();

    for (const order of orders) {
      await sendOrder(order);
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Delay of 3s between orders
    }

    console.log(`✅ Batch ${i + 1} completed.`);
    await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute before next batch
  }

  console.log("✅ Orders placed successfully.");
}

seedOrders();
