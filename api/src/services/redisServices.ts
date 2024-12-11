import Redis, { Redis as RedisClient } from "ioredis";

const redisClient: RedisClient = new Redis({
  host: "localhost",
  port: 6379,
});

redisClient
  .ping()
  .then((reply) => {
    console.log("Redis connection successful:", reply);
  })
  .catch((error) => {
    console.error("Redis connection error:", error);
  });

export const publishToQueue = async (queue: string, message: any) => {
  try {
    console.log(queue);
    console.log(message);
    await redisClient.rpush(queue, JSON.stringify(message));
  } catch (error) {
    console.log("Error publishing message:");
    throw new Error("Error publishing message");
  }
};
