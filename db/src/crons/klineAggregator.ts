import prisma from "../lib/prisma";
import { addDays, addHours, addMinutes, addWeeks, startOfDay, startOfHour, startOfMinute, startOfWeek } from "date-fns";

//intervals
const INTERVAL_CONFIG: { interval: string, durationMinutes: number }[] = [
    { interval: "1m", durationMinutes: 1 },
    { interval: "5m", durationMinutes: 5 },
    { interval: "1h", durationMinutes: 60 },
    { interval: "1d", durationMinutes: 1440 },
    { interval: "1w", durationMinutes: 10080 },
]

const MARKETS = ["BTC_USDC"]
async function main() {

    while (true) {
        try {
            for (const market of MARKETS) {
                for (const { interval, durationMinutes } of INTERVAL_CONFIG) {
                    await aggregateInterval(market, interval, durationMinutes)
                }
            }
            // ✅ Wait before the next aggregation run (production: 10s - 60s)
            await setTimeout(() => { }, 10000);
        } catch (err) {
            console.error("❌ Error in aggregator loop:", err);
            await setTimeout(() => { }, 5000);
        }
    }
}

async function aggregateInterval(market: string, interval: string, durationMinutes: number) {
    //get last processed time
    const stateKey = await prisma.aggregatorState.findUnique({
        where: { market_interval: { market, interval } },
    });

    let lastAggregated = stateKey?.lastTime || new Date(0);
    const now = new Date();

    const trades = await prisma.trade.findMany({
        where: {
            market,
            timestamp: {
                gte: lastAggregated,
                lte: now
            }
        },
        orderBy: {
            timestamp: 'asc'
        }
    })

    if (trades.length == 0) {
        updateAggregatorState(market, interval, now);
        return;
    };

    const bucketTrades = new Map<string, typeof trades>();

    for (const trade of trades) {
        const bucketKey = getBucketKey(trade.timestamp, durationMinutes)
        const key = bucketKey.toISOString();
        if (!bucketTrades.has(key)) {
            bucketTrades.set(key, [])
        }
        bucketTrades.get(key)?.push(trade)
    }

    //
    for (const [bucketIso, trades] of bucketTrades.entries()) {
        if (trades.length === 0) continue;

        trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

        const openPrice = trades[0].price;
        const closePrice = trades[trades.length - 1].price;
        let highPrice = openPrice;
        let lowPrice = openPrice;
        let volume = BigInt(0);

       for(const trade of trades) {
        if (trade.price > highPrice) highPrice = trade.price;
        if (trade.price < lowPrice) lowPrice = trade.price;
        volume += trade.quantity;
       }

       const bucketDate = new Date(bucketIso)
       const bucketEndDate = computeBucketEnd(bucketDate, durationMinutes);

       const klineId = `${market}_${interval}_${bucketIso}`

        await prisma.kline.upsert({
         where: { id : klineId },
         update: {
            high: highPrice,
            low: lowPrice,
            close: closePrice,
            volume: { increment : Number(volume)},
            trades: { increment: Number(trades.length) }  
        },
         create: {
            id: klineId,
            market,
            interval,
            open: openPrice,
            close: closePrice,
            high: highPrice,
            low: lowPrice,
            volume: volume,
            trades: trades.length,
            startTime: bucketDate,
            endTime: bucketEndDate,
         }
       })

       const lastTradeTimeStamp = trades[trades.length - 1].timestamp;

       await updateAggregatorState(market, interval, lastTradeTimeStamp);
    }
}

function getBucketKey(timestamp: Date, durationMinutes: number): Date {
    if (durationMinutes === 1) {
        return startOfMinute(timestamp);
    } else if (durationMinutes === 5) {
        return startOfXMinutes(timestamp, 5);
    } else if (durationMinutes === 60) {
        return startOfHour(timestamp);
    } else if (durationMinutes === 1440) {
        return startOfDay(timestamp);
    } else if (durationMinutes === 10080) {
        return startOfWeek(timestamp);
    }
    return startOfXMinutes(timestamp, durationMinutes);
}

function computeBucketEnd(bucketStart: Date, durationMinutes: number): Date {
  if (durationMinutes === 1) return addMinutes(bucketStart, 1);
  if (durationMinutes === 5) return addMinutes(bucketStart, 5);
  if (durationMinutes === 60) return addHours(bucketStart, 1);
  if (durationMinutes === 1440) return addDays(bucketStart, 1);
  if (durationMinutes === 10080) return addWeeks(bucketStart, 1);
  return addMinutes(bucketStart, durationMinutes);
}

function startOfXMinutes(timestamp: Date, durationMinutes: number) {
    const start = new Date(timestamp);
    start.setSeconds(0, 0);
    const min = start.getMinutes();
    const remainder = min % durationMinutes;
    start.setMinutes(min - remainder);
    return start;
}
async function updateAggregatorState(market: string, interval: string, newTime: Date) {
    await prisma.aggregatorState.upsert({
        where: { market_interval: { market, interval } },
        update: { lastTime: newTime },
        create: {
            market,
            interval,
            lastTime: newTime,
        },
    });
}

main().catch((err) => {
    console.error("❌ Fatal error in Kline Aggregator:", err);
    process.exit(1);
  });