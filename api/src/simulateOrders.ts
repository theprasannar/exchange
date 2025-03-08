// import axios from "axios";

// // URL for your createOrder API endpoint:
// const API_BASE_URL = "http://localhost:4000/api/v1/orders";

// // Market:
// const MARKET = "BTC_USDC";

// // Generate an array of 50 user IDs (if needed, though the seed file here picks randomly):
// const USER_IDS: string[] = Array.from({ length: 50 }, (_, i) => `user${i + 1}`);

// // Helper to generate a random integer between min and max (inclusive)
// const randomInt = (min: number, max: number): number => {
//   return Math.floor(Math.random() * (max - min + 1)) + min;
// };

// // Helper to randomly select order side
// const randomSide = (): "buy" | "sell" => (Math.random() < 0.5 ? "buy" : "sell");

// // Generate a random order with display values:
// // - Price: Base display price is 20000 USDC with ±5% fluctuation (i.e. about 19000–21000 USDC)
// // - Quantity: Random BTC quantity between 1 and 10 BTC.
// const generateRandomOrder = () => {
//   const basePrice = 20000; // display price in USDC
//   const fluctuation = basePrice * 0.05; // 5% fluctuation
//   const price = basePrice + randomInt(-fluctuation, fluctuation);

//   // For quantity, generate a random BTC quantity between 1 and 10:
//   const quantity = (Math.random() * (10 - 1) + 1).toFixed(8);

//   return {
//     market: MARKET,
//     price: price.toString(),       // Display USDC value (e.g., "20000")
//     quantity: quantity.toString(), // Display BTC value (e.g., "3.45678900")
//     side: randomSide(),
//     userId: USER_IDS[randomInt(0, USER_IDS.length - 1)],
//   };
// };

// async function sendOrder(orderData: any) {
//   try {
//     const response = await axios.post(API_BASE_URL, orderData);
//     console.log(`[${new Date().toISOString()}] Order placed:`, response.data);
//   } catch (error: any) {
//     console.error(
//       `[${new Date().toISOString()}] Error placing order:`,
//       error.response?.data || error.message
//     );
//   }
// }

// // Recursive function to send orders with a random delay between 3 and 10 seconds.
// function scheduleRandomOrder() {
//   const orderData = generateRandomOrder();
//   sendOrder(orderData);
//   // Generate a random delay between 3000ms (3s) and 10000ms (10s)
//   const delay = randomInt(10000, 20000);
//   console.log(`[${new Date().toISOString()}] Next order in ${delay}ms`);
//   setTimeout(scheduleRandomOrder, delay);
// }

// // Start the random order flow:
// scheduleRandomOrder();

import axios from "axios";

// 1) API Endpoint
const API_BASE_URL = "http://localhost:4000/api/v1/orders";

// 2) Market
const MARKET = "BTC_USDC";

// 3) Generate user IDs from user20 ... user70
const USER_IDS: string[] = Array.from({ length: 51 }, (_, i) => `user${i + 20}`);

// Helper to get random int
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Randomly choose buy or sell
function randomSide(): "buy" | "sell" {
  return Math.random() < 0.5 ? "buy" : "sell";
}

// Generate random price (around 100 ±10) and quantity (0.01–0.11 BTC), random type
function generateRandomOrder() {
  const basePrice = 100;
  const fluctuation = 10;
  const randomOffset = randomInt(-fluctuation, fluctuation);
  const price = basePrice + randomOffset;

  // quantity between 0.01 and 0.11 BTC
  const quantity = (Math.random() * 0.1 + 0.01).toFixed(8);

  const orderType: "limit" | "market" = Math.random() < 0.5 ? "limit" : "market";

  return {
    market: MARKET,
    price: price.toString(),
    quantity: quantity.toString(),
    side: randomSide(),
    userId: USER_IDS[randomInt(0, USER_IDS.length - 1)],
    orderType
  };
}

// Send the order to your matching engine
async function sendOrder(orderData: any) {
  try {
    const response = await axios.post(API_BASE_URL, orderData);
    console.log(`[${new Date().toISOString()}] Order placed:`, response.data);
  } catch (error: any) {
    console.error(
      `[${new Date().toISOString()}] Error placing order:`,
      error.response?.data || error.message
    );
  }
}

// Schedule repeated orders with 3–10s delay
function scheduleRandomOrder() {
  const orderData = generateRandomOrder();
  sendOrder(orderData);

  const delay = randomInt(3000, 10000); // 3–10 seconds
  console.log(`[${new Date().toISOString()}] Next order in ${delay}ms`);
  setTimeout(scheduleRandomOrder, delay);
}

// Start
scheduleRandomOrder();
