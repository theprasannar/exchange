// @ts-nocheck

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Candle } from "../types/types";
import { getKlines } from "../lib/api";
import { SignalingManager } from "../utils/SignalingManager";


interface KlineState {
    candles: Candle[];
    interval: string;
    market: string;
}

const initialState :KlineState = {
    candles : [],
    interval : '1m',
    market : 'BTC_USDC'
}
export const fetchKlineData = createAsyncThunk(
    'kline/getKlines', async ({market, interval, limit} :{market: string, interval : string, limit?: number}, {rejectWithValue}) => {
        try {
            const data = await getKlines(market, interval, limit);
            return {market , interval , candles : data}
        } catch (error) {
            return rejectWithValue(error);
        }
    }
)
export const klineSlice = createSlice({
    name: 'kline',
    initialState,
    reducers: {
        updateKlineData : (state, action : PayloadAction<Candle>) => {
            // fetch the latest candle data
            const lastCandle = state.candles[state.candles.length - 1];
            const newCandle = action.payload

            if(!lastCandle) {
                state.candles.push(newCandle);
                return;
            }

            //candle exist, so we verify the start time
            if(lastCandle.startTime === action.payload.startTime) {
                //in place change
                state.candles[state.candles.length - 1] = newCandle;
                return;
            }  else if (lastCandle.startTime > newCandle.startTime) {
                //add a new candle
                state.candles.push(newCandle);
                return;
            } else {
                //old data that is ignored
            }
        }
    },
    extraReducers: (builder) => {
        builder
           .addCase(fetchKlineData.fulfilled, (state, action) => {
                state.market = action.payload.market;
                state.interval = action.payload.interval;
                state.candles = action.payload.candles;
            })
    }
})

export const subscribeKlines = (market : string, interval: string) => (dispatch : any) =>{
    const callbackId = `Kline_${market}${interval}`
    const streamKey = `kline@${market}_${interval}`;
    SignalingManager.getInstance().registerCallback('kline', (msg) => {
        const klineData = msg.data ?? msg.data
        //convert the data into formate
        const kline : Candle = {
            close : klineData.c,
            endTime : klineData.w,
            high : klineData.h,
            low : klineData.l,
            open : klineData.o,
            startTime : klineData.s, 
            trades : klineData.t,
            volume : klineData.v
        }
        // dispatch the action to update the state
        dispatch(updateKlineData(kline))
    }, callbackId)

    SignalingManager.getInstance().sendMessage({
        method: "SUBSCRIBE",
        params: [streamKey],
    })

    return () => {
        SignalingManager.getInstance().deRegisterCallback('kline', callbackId)
        SignalingManager.getInstance().sendMessage({
            method: "UNSUBSCRIBE",
            params: [streamKey],
        })
    }
}
export  const {updateKlineData} = klineSlice.actions;
export default klineSlice.reducer;
