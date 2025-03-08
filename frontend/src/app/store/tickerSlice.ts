import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getTicker } from "../lib/api"; // Assume this API returns ticker data
import { SignalingManager } from "../utils/SignalingManager";
import { atomicToBtc, atomicToUsdc } from "../utils/currency";

// Define the shape of our ticker state.
export interface TickerState {
  lastPrice: string;  // e.g. display USDC price
  high: string;
  low: string;
  volume: string;
  symbol: string;
  updatedAt: number | null;
}

const initialState: TickerState = {
  lastPrice: "0",
  high: "0",
  low: "0",
  volume: "0",
  symbol: "",
  updatedAt: null,
};

// Async thunk to fetch initial ticker data from an API endpoint.
export const fetchTickerData = createAsyncThunk(
  "ticker/fetchTickerData",
  async (market: string, { rejectWithValue }) => {
    try {
      const data = await getTicker(market);
      console.log(" data:", data) 
      // Assume data has properties c, h, l, v, s, id (all as strings/numbers) in atomic format
      return {
        lastPrice: atomicToUsdc(BigInt(data.currentPrice)),
        high: atomicToUsdc(BigInt(data.high)),
        low: atomicToUsdc(BigInt(data.low)),
        volume: atomicToBtc(BigInt(data.volume)), // volume can remain as is or be converted if needed
        symbol: data.symbol
      };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const tickerSlice = createSlice({
  name: "ticker",
  initialState,
  reducers: {
    updateTicker: (state, action: PayloadAction<TickerState>) => {
      state.lastPrice = action.payload.lastPrice;
      state.high = action.payload.high;
      state.low = action.payload.low;
      state.volume = action.payload.volume;
      state.symbol = action.payload.symbol;
      state.updatedAt = action.payload.updatedAt;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchTickerData.fulfilled, (state, action) => {
      state.lastPrice = action.payload.lastPrice;
      state.high = action.payload.high;
      state.low = action.payload.low;
      state.volume = action.payload.volume;
      state.symbol = action.payload.symbol;
      state.updatedAt = action.payload.updatedAt;
    });
    builder.addCase(fetchTickerData.rejected, (state, action) => {
      console.error("Failed to fetch ticker data:", action.payload);
    });
  },
});

// Thunk to subscribe to ticker updates via the SignalingManager.
// This is analogous to subscribeDepth.
export const subscribeTicker = (market: string) => (dispatch: any) => {
  const manager = SignalingManager.getInstance();
  const callbackId = `Ticker_${market}`;
  
  manager.registerCallback("ticker", (msg) => {
    const data = msg.data;
    console.log(" manager.registerCallback ~ data:", data)
    dispatch(
      tickerSlice.actions.updateTicker({
        lastPrice: data.c ? atomicToUsdc(BigInt(data.c)) : "0",
        high: data.h ? atomicToUsdc(BigInt(data.h)) : "0",
        low: data.l ? atomicToUsdc(BigInt(data.l)) : "0",
        volume: atomicToBtc(BigInt(data.v)) || "0",
        symbol: data.s || market,
        updatedAt: data.id,
      })
    );
  }, callbackId);

  console.log('before sub')
  manager.sendMessage({ method: "SUBSCRIBE", params: [`ticker@${market}`] });
  console.log('after sub')


  return () => {
    manager.deRegisterCallback("ticker", callbackId);
    manager.sendMessage({ method: "UNSUBSCRIBE", params: [`ticker@${market}`] });
  };
};

export const { updateTicker } = tickerSlice.actions;
export default tickerSlice.reducer;
