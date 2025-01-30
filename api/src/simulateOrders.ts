import { Engine } from "../../engine/src/trade/engine";

// Initialize engine instance
const engine = new Engine();

function generateRandomOrder() {
  const market = "BTC_INR";  
  const side = Math.random() > 0.5 ? "buy" : "sell"; 
  const price = (Math.random() * (51000 - 49000) + 49000).toFixed(2);
  const quantity = (Math.random() * 0.5).toFixed(4); 
  const userId = `user${Math.floor(Math.random() * 10) + 1}`;

  console.log(`Placing ${side.toUpperCase()} order: ${quantity} BTC at ₹${price} by ${userId}`);

  try {
    engine.createOrder(market, quantity, price, side, userId);
  } catch (error: any) {
    console.error("Error placing order:", error.message);

    if (error.message.includes("Insufficient balance for")) {
      console.log(`Topping up INR balance for user: ${userId} ...`);
      engine.onRamp(userId, 5_000_000);
      
      // NESTED TRY-CATCH FOR RETRY
      try {
        console.log(`Retrying the BUY order...`);
        engine.createOrder(market, quantity, price, side, userId);
      } catch (retryError) {
        //@ts-ignore
        console.error("Retry failed:", retryError.message);
      }

    } else if (error.message.includes("Insufficient funds")) {
      console.log(`Topping up BTC balance for user: ${userId} ...`);
      const userBalances = engine["balance"].get(userId);
      if (userBalances && userBalances["BTC"]) {
        userBalances["BTC"].available += 100;
      }
      
      // NESTED TRY-CATCH FOR RETRY
      try {
        console.log(`Retrying the SELL order...`);
        engine.createOrder(market, quantity, price, side, userId);
      } catch (retryError) {
        //@ts-ignore
        console.error("Retry failed:", retryError.message);
      }
    } else {
      console.error("Unknown error placing order:", error);
    }
  }
}

// Continuously place random orders every 1 second
setInterval(generateRandomOrder, 1000);
