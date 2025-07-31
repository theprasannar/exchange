import { createClient } from "redis";
import { Engine } from "./trade/engine";

// --- configuration ----------------------------------------------------------

const ORDERS_STREAM = process.env.ORDERS_STREAM ?? "orders"; // stream key
const GROUP_NAME = "engine"; // consumer‑group
const CONSUMER_NAME = "worker-1"; // this process

// --- helpers ----------------------------------------------------------------

async function waitForRedisReady(client: ReturnType<typeof createClient>) {
  while (true) {
    try {
      const role = await client.sendCommand<string[]>(["ROLE"]);
      if (Array.isArray(role) && role[0] === "master") break;
    } catch {
      /* ignore until Redis is ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const engine = new Engine();
  const redisClient = createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  }); // ← GOOD

  await redisClient.connect();
  console.log("🔌  Engine connected to Redis");

  await waitForRedisReady(redisClient);

  // ensure consumer‑group exists (idempotent)
  await redisClient
    .xGroupCreate(ORDERS_STREAM, GROUP_NAME, "0", { MKSTREAM: true })
    .catch((e) => {
      if (!e.message.includes("BUSYGROUP")) throw e;
    });

  console.log("🚀  Consumer‑group ready, entering main loop");

  while (true) {
    const response = await redisClient.xReadGroup(
      GROUP_NAME,
      CONSUMER_NAME,
      [{ key: ORDERS_STREAM, id: ">" }],
      { COUNT: 1, BLOCK: 0 }
    );

    if (!response) continue; // nothing to do

    // xReadGroup always returns this nested shape:
    // [ [ streamKey, [ [ entryId, { field: value, ... } ] ] ] ]
    for (const stream of response) {
      for (const msg of stream.messages) {
        const entryId = msg.id;
        const fields = msg.message; // { json: '…' }

        try {
          const payload = JSON.parse(fields.json);
          const { clientId } = payload;

          const result = engine.process(payload);
          if (result) {
            await redisClient.publish(clientId, JSON.stringify(result));
          }

          await redisClient.xAck(ORDERS_STREAM, GROUP_NAME, entryId);
        } catch (err) {
          console.error("❌  Failed to handle entry", entryId, err);
          // un‑acked → will replay after restart
        }
      }
    }
  }
}

main().catch((err) => {
  console.error("Engine crashed", err);
  process.exit(1);
});
