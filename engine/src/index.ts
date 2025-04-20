import { createClient, RedisClientType } from "redis";
import { Engine } from "./trade/engine";

async function main() {
  const engine = new Engine();
  const redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.connect();
  console.log("Successfully connected");

  while (true) {
    const message = await redisClient.brPop("message", 0);

    if (message) {
      try {
        // Use object destructuring
        const { element } = message;
        const parsedPayload = JSON.parse(element);

        const { clientId, message: orderMessage } = parsedPayload;

        const response = engine.process(parsedPayload);

        if (response ?? false) {
          await redisClient.publish(clientId, JSON.stringify(response));
        } else {
        }
      } catch (error) {
        console.error("Failed to process message:", message, error);
      }
    } else {
      console.warn("No message received.");
    }
  }
}

main();
