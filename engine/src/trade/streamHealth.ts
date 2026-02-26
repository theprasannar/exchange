import { RedisManager } from "../redisManager";

export interface StreamGroupHealth {
  name: string;
  pending: number;
  consumers: number;
  lastDeliveredId: string;
  lag?: number;
}

export interface StreamHealth {
  stream: string;
  length: number;
  firstEntryId: string | null;
  lastEntryId: string | null;
  groups: StreamGroupHealth[];
}

/**
 * Get health information for a specific Redis stream including
 * consumer group status, pending messages, and lag.
 */
export async function getStreamHealth(
  streamName: string
): Promise<StreamHealth | null> {
  const rm = RedisManager.getInstance();

  try {
    const streamInfo = await rm.xInfoStream(streamName);
    const groupsInfo = await rm.xInfoGroups(streamName);

    return {
      stream: streamName,
      length: streamInfo.length,
      firstEntryId: streamInfo.firstEntry?.[0] ?? null,
      lastEntryId: streamInfo.lastEntry?.[0] ?? null,
      groups: groupsInfo.map((g: any) => ({
        name: g.name,
        pending: g.pending,
        consumers: g.consumers,
        lastDeliveredId: g.lastDeliveredId,
        lag: g.lag ?? undefined,
      })),
    };
  } catch (e: any) {
    // Stream might not exist yet
    if (e.message?.includes("no such key")) {
      return null;
    }
    throw e;
  }
}

/**
 * Check stream health across all critical streams and log alerts
 * for high lag or pending message counts.
 */
export async function checkStreamHealthAndAlert(): Promise<void> {
  const ALERT_LAG_THRESHOLD = 10000; // Alert if more than 10k messages behind
  const CRITICAL_STREAMS = ["events", "sidefx", "orders"];

  for (const stream of CRITICAL_STREAMS) {
    try {
      const health = await getStreamHealth(stream);
      if (!health) continue;

      for (const group of health.groups) {
        if (group.pending > ALERT_LAG_THRESHOLD) {
          console.error(
            `🚨 ALERT: Stream "${stream}" group "${group.name}" has ${group.pending} pending messages!`
          );
        }

        // Also check lag if available (Redis 7+)
        if (group.lag !== undefined && group.lag > ALERT_LAG_THRESHOLD) {
          console.error(
            `🚨 ALERT: Stream "${stream}" group "${group.name}" has lag of ${group.lag}!`
          );
        }
      }

      // Log health summary
      console.log(
        `Stream health: ${stream} - length: ${health.length}, groups: ${health.groups.length}`
      );
    } catch (e) {
      console.error(`Failed to check health for stream ${stream}:`, e);
    }
  }
}

/**
 * Start periodic health checks. Call this once on engine startup.
 */
export function startHealthMonitoring(intervalMs = 60000): ReturnType<typeof setInterval> {
  console.log(`Starting stream health monitoring (interval: ${intervalMs}ms)`);

  // Run immediately, then on interval
  checkStreamHealthAndAlert().catch(console.error);

  return setInterval(() => {
    checkStreamHealthAndAlert().catch(console.error);
  }, intervalMs);
}
