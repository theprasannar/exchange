import axios from "axios";

// URL for your createOrder API endpoint
const API_BASE_URL = "http://localhost:4000/api/v1/orders";

// Define an interface for the order data we will send
interface OrderData {
  market: string;
  price: string;      // Price in atomic INR (paise) as a string
  quantity: string;   // Quantity in atomic BTC (satoshis) as a string
  side: "buy" | "sell";
  userId: string;
}

/*
  We want to test different scenarios:
    1. Partial buy – e.g., a buy order that only partially fills an existing sell order.
    2. Full buy – a buy order that completely matches an existing sell order.
    3. Partial sell – a sell order that is only partially matched by an incoming buy.
    4. Full sell – a sell order that gets completely filled.
    
  Below is one example seed dataset with exactly 5 sell orders and 5 buy orders.
*/

// We'll assume market "BTC_USDC" and fixed conversion:
// - Price is given as a string representing paise (e.g., "50000000" = 500,000 INR)
// - Quantity is given as a string representing satoshis (e.g., "100000000" = 1 BTC)

const orders: OrderData[] = [
  // Sell orders:
  // Order A: Sell 1 BTC at 50,000,000 paise (500,000 INR)
  {
    market: "BTC_USDC",
    price: "50000000",
    quantity: "100000000",
    side: "sell",
    userId: "user1",
  },
  // Order B: Sell 0.5 BTC at 51,000,000 paise
  {
    market: "BTC_USDC",
    price: "51000000",
    quantity: "50000000",
    side: "sell",
    userId: "user2",
  },
  // Order C: Sell 0.3 BTC at 52,000,000 paise
  {
    market: "BTC_USDC",
    price: "52000000",
    quantity: "30000000",
    side: "sell",
    userId: "user3",
  },
  // Order D: Sell 0.7 BTC at 49,000,000 paise (lower price to encourage matching with buys)
  {
    market: "BTC_USDC",
    price: "49000000",
    quantity: "70000000",
    side: "sell",
    userId: "user4",
  },
  // Order E: Sell 0.4 BTC at 53,000,000 paise
  {
    market: "BTC_USDC",
    price: "53000000",
    quantity: "40000000",
    side: "sell",
    userId: "user5",
  },
  // Buy orders:
  // Order F: Buy 0.5 BTC at 50,000,000 paise – should partially fill Order A (partial buy)
  {
    market: "BTC_USDC",
    price: "50000000",
    quantity: "50000000",
    side: "buy",
    userId: "user6",
  },
  // Order G: Buy 0.5 BTC at 50,000,000 paise – should fully fill the remainder of Order A (full buy)
  {
    market: "BTC_USDC",
    price: "50000000",
    quantity: "50000000",
    side: "buy",
    userId: "user7",
  },
  // Order H: Buy 1 BTC at 49,000,000 paise – may partially match Order D (partial sell)
  {
    market: "BTC_USDC",
    price: "49000000",
    quantity: "100000000",
    side: "buy",
    userId: "user8",
  },
  // Order I: Buy 0.3 BTC at 52,000,000 paise – should fully match Order C (full buy)
  {
    market: "BTC_USDC",
    price: "52000000",
    quantity: "30000000",
    side: "buy",
    userId: "user9",
  },
  // Order J: Buy 0.4 BTC at 53,000,000 paise – should fully match Order E (full buy)
  {
    market: "BTC_USDC",
    price: "53000000",
    quantity: "40000000",
    side: "buy",
    userId: "user10",
  },
];

async function sendOrder(order: OrderData) {
  try {
    const response = await axios.post(API_BASE_URL, order);
    console.log(`[${new Date().toISOString()}] Order placed:`, response.data);
  } catch (error: any) {
    console.error(
      `[${new Date().toISOString()}] Error placing order:`,
      error.response?.data || error.message
    );
  }
}

async function seedTestOrders() {
  // Send each order sequentially with a delay between orders.
  for (const order of orders) {
    await sendOrder(order);
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay of 500ms
  }
  console.log("Test orders seeded.");
}

seedTestOrders();
