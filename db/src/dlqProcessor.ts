//@ts-nocheck
/**
 * Dead Letter Queue (DLQ) Processor
 * 
 * This service processes messages that have failed multiple times in the main DB processor.
 * It attempts to reprocess them or moves them to permanent failure storage after max retries.
 * 
 * Run this as a separate process: `npx ts-node src/dlqProcessor.ts`
 */

import * as http from "http";
import { createClient } from "redis";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Render's free tier only offers "web service" instances (background workers
// require a paid plan), and a web service must bind to $PORT and answer
// health checks. This process has no HTTP API — this listener exists solely
// to satisfy that requirement so it can run as a free web service.
if (process.env.PORT) {
  http
    .createServer((_req, res) => res.writeHead(200).end("ok"))
    .listen(Number(process.env.PORT), () => {
      console.log(`🩺 Health check listener on port ${process.env.PORT}`);
    });
}

const DLQ_STREAM = "dead:ledger";
const MAX_RETRY_ATTEMPTS = 10;
const CHECK_INTERVAL_MS = 60_000; // Check DLQ every minute

interface DLQEntry {
  id: string;
  stream: string;
  originalId: string;
  json: string;
  retryCount: number;
}

async function processDLQ(): Promise<void> {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();
  
  console.log("🔄 DLQ Processor started...");

  while (true) {
    try {
      // Read from DLQ (oldest entries first)
      const entries = await client.xRange(DLQ_STREAM, "-", "+", { COUNT: 10 });

      if (entries.length === 0) {
        console.log(`DLQ empty, waiting ${CHECK_INTERVAL_MS / 1000}s...`);
        await new Promise((r) => setTimeout(r, CHECK_INTERVAL_MS));
        continue;
      }

      console.log(`Processing ${entries.length} DLQ entries...`);

      for (const entry of entries) {
        const message = entry.message as any;
        const originalStream = message.stream;
        const originalId = message.id;
        const rawJson = message.json;

        console.log(`DLQ: Processing ${originalId} from ${originalStream}`);

        try {
          // Parse and increment retry count
          const event = JSON.parse(rawJson);
          event.retryCount = (event.retryCount || 0) + 1;

          if (event.retryCount > MAX_RETRY_ATTEMPTS) {
            // Move to permanent failure table
            await prisma.permanentFailure.create({
              data: {
                eventId: originalId,
                stream: originalStream,
                payload: rawJson,
                error: `Max retries exceeded (${MAX_RETRY_ATTEMPTS})`,
              },
            }).catch((e: any) => {
              // Ignore unique constraint violations (already recorded)
              if (e.code !== "P2002") throw e;
            });

            console.error(`❌ DLQ: Permanently failed ${originalId} after ${event.retryCount} attempts`);
            
            // Remove from DLQ
            await client.xDel(DLQ_STREAM, entry.id);
            continue;
          }

          // Re-add to original stream for reprocessing
          await client.xAdd(originalStream, "*", { 
            json: JSON.stringify(event) 
          });
          
          console.log(`✅ DLQ: Requeued ${originalId} to ${originalStream} (attempt ${event.retryCount})`);

          // Remove from DLQ
          await client.xDel(DLQ_STREAM, entry.id);
        } catch (e) {
          console.error(`DLQ: Failed to process ${entry.id}:`, e);
          // Leave in DLQ for next iteration
        }
      }

      // Small delay between batches
      await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      console.error("DLQ Processor error:", e);
      await new Promise((r) => setTimeout(r, 5000)); // Wait before retrying
    }
  }
}

/**
 * Get DLQ statistics for monitoring
 */
async function getDLQStats(): Promise<{
  pendingCount: number;
  oldestEntryAge: number | null;
}> {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = createClient({ url });
  await client.connect();

  try {
    const info = await client.xLen(DLQ_STREAM);
    
    let oldestEntryAge: number | null = null;
    if (info > 0) {
      const entries = await client.xRange(DLQ_STREAM, "-", "+", { COUNT: 1 });
      if (entries.length > 0) {
        // Parse timestamp from stream ID (format: timestamp-sequence)
        const [timestamp] = entries[0].id.split("-");
        oldestEntryAge = Date.now() - parseInt(timestamp, 10);
      }
    }

    await client.quit();
    
    return {
      pendingCount: info,
      oldestEntryAge,
    };
  } catch (e: any) {
    if (e.message?.includes("no such key")) {
      await client.quit();
      return { pendingCount: 0, oldestEntryAge: null };
    }
    await client.quit();
    throw e;
  }
}

// Export for use in health checks
export { getDLQStats };

// Run the processor
processDLQ().catch((e) => {
  console.error("DLQ Processor crashed:", e);
  process.exit(1);
});
