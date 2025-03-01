import { addWeeks } from 'date-fns';
import { addDays } from 'date-fns';
import { addHours } from 'date-fns';
import { addMinutes } from 'date-fns';
import { startOfWeek } from 'date-fns';
import { startOfDay } from 'date-fns';
import { startOfHour } from 'date-fns';
import { startOfMinute } from 'date-fns';
import { RedisManager } from "../redisManager";


const INTERVALS = [
    { interval: "1m", duration: 1, },
    { interval: "5m", duration: 5, },
    { interval: "15m", duration: 15, },
    { interval: "30m", duration: 30, },
    { interval: "1h", duration: 60, },
    { interval: "1d", duration: 1440, }
]

interface TradeData {
    market: string;
    price: string;
    quantity: string;
    quoteQuantity?: string; // Optional
    timestamp: number;
}
interface TradeMessage {
    type: string; // "TRADE_ADDED", etc.
    data: TradeData
}


interface LiveCandle {
    open: bigint;
    close: bigint;
    high: bigint;
    low: bigint;
    volume: bigint;
    trades: number;
    start: Date;
    end: Date;
}

// For each market, for each interval, store the "current" candle
// e.g. liveCandles["BTC_USDC"]["1m"] => LiveCandle
const liveCandles: Record<string, Record<string, LiveCandle>> = {};

export const initRealTimeKlineAggregator = () => {
    RedisManager.getInstance().subscribe('trade_channel', (msg: string) => {
        const trade: TradeMessage = JSON.parse(msg);

        if (trade.type === 'TRADE_ADDED') {
            handleNewTrade(trade.data)
        }
    })
}

const handleNewTrade = (trade: TradeData) => {

    const { market, price, quantity, timestamp } = trade;

    const p = BigInt(price);
    const q = BigInt(quantity);
    const tradeTime = new Date(timestamp);

    for (const { interval, duration } of INTERVALS) {

        if (!liveCandles[market]) {
            liveCandles[market] = {};
        }

        const candle = liveCandles[market][interval];

        if (!candle || tradeTime >= candle.end) {
            const newCandle = createCandle(market, duration, p, q, tradeTime);
            liveCandles[market][interval] = newCandle;
            broadcastPartialKline(market, interval, newCandle)
        } else {
            updateCandle(candle, p, q);
            broadcastPartialKline(market, interval, candle)
        }

    }
}
const createCandle = (market: string, duration: number, p: bigint, q: bigint, tradeTime: Date) => {

    const startOfBucket = computeBucketStart(tradeTime, duration);
    const endOfBucket = computeBucketEnd(tradeTime, duration);
    return {
        open: p,
        high: p,
        low: p,
        close: p,
        start: startOfBucket,
        end: endOfBucket,
        volume: q,
        trades: 1
    }
}

const updateCandle = (candle: LiveCandle, price: bigint, quantity: bigint) => {
    if (price > candle.high) candle.high = price;
    if (price < candle.low) candle.low = price;
    candle.close = price;
    candle.volume += quantity;
    candle.trades++;
}

const broadcastPartialKline = (market: string, interval: string, candle: LiveCandle)  => {
    RedisManager.getInstance().publishMessage(`kline@${market}_${interval}`, {
        stream: `kline@${market}_${interval}`,
        data : {
            e: "kline",
            market,
            interval,
            o: candle.open.toString(),
            h: candle.high.toString(),
            l: candle.low.toString(),
            c: candle.close.toString(),
            v: candle.volume.toString(),
            t: candle.trades.toString(),
            sT: candle.start.getTime(),
            eT: candle.end.getTime(),
        }
    })
}
function computeBucketStart(timestamp: Date, durationMinutes: number): Date {
    if (durationMinutes === 1) {
        return startOfMinute(timestamp);
    } else if (durationMinutes === 5) {
        return startOfXMinutes(timestamp, 5);
    } else if (durationMinutes === 15) {
        return startOfXMinutes(timestamp, 15);
    } else if (durationMinutes === 30) {
        return startOfXMinutes(timestamp, 30);
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
    if (durationMinutes === 15) return addMinutes(bucketStart, 15);
    if (durationMinutes === 30) return addMinutes(bucketStart, 30);
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
