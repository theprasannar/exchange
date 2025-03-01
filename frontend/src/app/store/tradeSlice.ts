import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getTrades } from "../lib/api";
import { Trade } from "../types/types";
import { SignalingManager } from "../utils/SignalingManager";
import { atomicToBtc, atomicToUsdc } from "../utils/currency";


export function formatTime(timestamp: string): string {
  const date = new Date(timestamp); // Pass the ISO string directly to Date
  if (isNaN(date.getTime())) {
    console.error("Invalid timestamp:", timestamp);
    return "Invalid Time";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

type TradesState = {
    trades: Trade[];
  };
  
  const initialState: TradesState = {
    trades: []
  };
  
  // Fetch Trades Data (API Call)
  export const fetchTradesData = createAsyncThunk(
    "trades/fetchTradesData",
    async ({market, limit} : {market: string, limit: number}, { rejectWithValue }) => {
      try {
        const trades = await getTrades(market, limit);
        return trades.map((trade) => ({
          ...trade,
          timestamp: formatTime(trade.timestamp) // Now it's an ISO string
        }));
      } catch (error) {
        return rejectWithValue(error);
      }
    }
  );
  
  // Create Redux Slice
  const tradesSlice = createSlice({
    name: "trades",
    initialState,
    reducers: {
        updateTrades : (state, action : PayloadAction<Trade>) => {
          console.log('action,', action.payload);
          const newTrade = {
            isBuyerMaker: action.payload.m,
            price: atomicToUsdc(action.payload.p),
            quantity: atomicToBtc(action.payload.q),
            timestamp: formatTime(action.payload.T) // Now it's an ISO string
          }
            state.trades.unshift(newTrade);
            if (state.trades.length > 50) {
                state.trades.pop();
            } 
        }
    },
    extraReducers: (builder) => {
      builder
        .addCase(fetchTradesData.fulfilled, (state, action: PayloadAction<Trade[]>) => {
          state.trades = action.payload;
        })
        .addCase(fetchTradesData.rejected, (state, action) => {
          console.error("Failed to fetch trades:", action.payload);
        });
    },
  });
  
export const { updateTrades } = tradesSlice.actions;
  export default tradesSlice.reducer;

  export const subscribeTrades = (market: string)  => (dispatch :any ) => {

    const callbackId = `Trade_${market}`
    SignalingManager.getInstance().registerCallback(`trade`, (msg) => {
        let tradeData = msg.data ?? msg.data;
        console.log("SignalingManager.getInstance ~ tradeData:", tradeData)
        dispatch(updateTrades({...tradeData, timestamp: formatTime(tradeData.T)}))
    }, callbackId)

    SignalingManager.getInstance().sendMessage({method : "SUBSCRIBE", params: [`trade@${market}`]})

    return () => {
        SignalingManager.getInstance().deRegisterCallback(`trade`, callbackId)
        SignalingManager.getInstance().sendMessage({method : "UNSUBSCRIBE", params: [`trade@${market}`]})
    }
  }

  /*
  {
  "stream": "trade@BTC_USDC",
  "data": {
    "e": "trade",
    "t": 12345,
    "p": "20099.5",
    "q": "0.250",
    "T": 1674813000000,
    "m": false,
    "s": "BTC_USDC"
  }
}
 */