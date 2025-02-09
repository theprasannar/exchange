import axios from "axios";

// URL for your createOrder API endpoint:
const API_BASE_URL = "http://localhost:4000/api/v1/orders";

// Market:
const MARKET = "BTC_USDC";

// Generate an array of 50 user IDs (if needed, though the seed file here picks randomly):
const USER_IDS: string[] = Array.from({ length: 50 }, (_, i) => `user${i + 1}`);

// Helper to generate a random integer between min and max (inclusive)
const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Helper to randomly select order side
const randomSide = (): "buy" | "sell" => (Math.random() < 0.5 ? "buy" : "sell");

// Generate a random order with display values:
// - Price: Base display price is 20000 USDC with ±5% fluctuation (i.e. about 19000–21000 USDC)
// - Quantity: Random BTC quantity between 1 and 10 BTC.
const generateRandomOrder = () => {
  const basePrice = 20000; // display price in USDC
  const fluctuation = basePrice * 0.05; // 5% fluctuation
  const price = basePrice + randomInt(-fluctuation, fluctuation);

  // For quantity, generate a random BTC quantity between 1 and 10:
  const quantity = (Math.random() * (10 - 1) + 1).toFixed(8);

  return {
    market: MARKET,
    price: price.toString(),       // Display USDC value (e.g., "20000")
    quantity: quantity.toString(), // Display BTC value (e.g., "3.45678900")
    side: randomSide(),
    userId: USER_IDS[randomInt(0, USER_IDS.length - 1)],
  };
};

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

// Recursive function to send orders with a random delay between 3 and 10 seconds.
function scheduleRandomOrder() {
  const orderData = generateRandomOrder();
  sendOrder(orderData);
  // Generate a random delay between 3000ms (3s) and 10000ms (10s)
  const delay = randomInt(1000, 2000);
  console.log(`[${new Date().toISOString()}] Next order in ${delay}ms`);
  setTimeout(scheduleRandomOrder, delay);
}

// Start the random order flow:
scheduleRandomOrder();
