import axios from 'axios';

// Adjust these values based on your API endpoint, market, and desired randomness.
const API_BASE_URL = 'http://localhost:4000/api/v1/orders';
const MARKET = 'BTC_USDC';
const USER_IDS = ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8', 'user9', 'user10'];

// Helper functions to generate random numbers within a range
const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Generate a random order side
const randomSide = (): "buy" | "sell" => (Math.random() < 0.5 ? "buy" : "sell");

// For this example, assume:
// - Price (in INR) is provided as a number (which gets converted to paise internally).
// - Quantity (in BTC) is provided as a number (converted to satoshis internally).
const generateRandomOrder = () => {
  // For price, assume a base of 500,000 INR and random fluctuation of ±5%
  const basePrice = 500000;
  const priceFluctuation = basePrice * 0.05;
  const price = basePrice + randomInt(-priceFluctuation, priceFluctuation);

  // For quantity, assume a base between 0.01 and 0.1 BTC
  const quantity = (Math.random() * (0.1 - 0.01) + 0.01).toFixed(8);

  return {
    market: MARKET,
    price: price.toString(),         // Pass as string (your controller converts it)
    quantity: quantity.toString(),   // as string too
    side: randomSide(),
    userId: USER_IDS[randomInt(0, USER_IDS.length - 1)],
  };
};

async function sendOrder() {
  const orderData = generateRandomOrder();
  try {
    const response = await axios.post(API_BASE_URL, orderData);
    console.log(`[${new Date().toISOString()}] Order placed:`, response.data);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Error placing order:`, error.response?.data || error.message);
  }
}

// Continuously send an order every 500ms (adjust the interval as desired)
setInterval(sendOrder, 500);
