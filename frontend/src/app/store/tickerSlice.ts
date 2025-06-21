import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getTicker } from "../lib/api"; // Assume this API returns ticker data
import { SignalingManager } from "../utils/SignalingManager";
import { atomicToBtc, atomicToUsdc } from "../utils/currency";

// Define the shape of our ticker state.
export interface TickerState {
  lastPrice: string; // e.g. display USDC price
  high: string;
  low: string;
  volume: string;
  symbol: string;
  updatedAt: number | null;
  createdAt?: number;
  volume24h: string;
  high24h: string;
  low24h: string;
  open24h: string;
  change24h: string;
}

const initialState: TickerState = {
  lastPrice: "0",
  high: "0",
  low: "0",
  volume: "0",
  symbol: "",
  updatedAt: null,
  volume24h: "0",
  high24h: "0",
  low24h: "0",
  open24h: "0",
  change24h: "0",
};

// Async thunk to fetch initial ticker data from an API endpoint.
export const fetchTickerData = createAsyncThunk(
  "ticker/fetchTickerData",
  async (market: string, { rejectWithValue }) => {
    try {
      const data = await getTicker(market);
      console.log(" data:", data);
      return {
        lastPrice: atomicToUsdc(BigInt(data.currentPrice)),
        high: atomicToUsdc(BigInt(data.high)),
        low: atomicToUsdc(BigInt(data.low)),
        volume: atomicToBtc(BigInt(data.volume)),
        high24h: atomicToUsdc(BigInt(data.high24h)),
        low24h: atomicToUsdc(BigInt(data.low24h)),
        volume24h: atomicToBtc(BigInt(data.volume24h)),
        change24h: String(data.change24h),
        open24h: atomicToUsdc(BigInt(data.open24h)),
        updatedAt: Date.now(),
        symbol: data.symbol,
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
      state.high24h = action.payload.high24h;
      state.low24h = action.payload.low24h;
      state.volume24h = action.payload.volume24h;
      state.open24h = action.payload.open24h;
      state.change24h = action.payload.change24h;
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
      state.high24h = action.payload.high24h;
      state.low24h = action.payload.low24h;
      state.volume24h = action.payload.volume24h;
      state.open24h = action.payload.open24h;
      state.change24h = action.payload.change24h;
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

  manager.registerCallback(
    "ticker",
    (msg) => {
      const data = msg.data;
      if (data.c == null || data.o24 == null) {
        console.warn("Missing values for change24h calculation:", {
          last: data.c,
          o24: data.o24,
        });
      }
      const change24h = data.ch24
        ? Number(
            ((BigInt(data.c) - BigInt(data.o24)) * 10000n) / BigInt(data.o24)
          ) / 100
        : 0;

      console.log(" manager.registerCallback ~ data:", data);
      dispatch(
        tickerSlice.actions.updateTicker({
          lastPrice: data.c ? atomicToUsdc(BigInt(data.c)) : "0",
          high: data.h ? atomicToUsdc(BigInt(data.h)) : "0",
          low: data.l ? atomicToUsdc(BigInt(data.l)) : "0",
          volume: atomicToBtc(BigInt(data.v)) || "0",
          symbol: data.s || market,
          updatedAt: data.id,
          high24h: data.h24 ? atomicToUsdc(BigInt(data.h24)) : "0",
          low24h: data.l24 ? atomicToUsdc(BigInt(data.l24)) : "0",
          open24h: data.o24 ? atomicToUsdc(BigInt(data.o24)) : "0",
          volume24h: data.v24 ? atomicToBtc(BigInt(data.v24)) : "0",
          change24h: change24h.toString() ?? "0",
        })
      );
    },
    callbackId
  );

  manager.sendMessage({ method: "SUBSCRIBE", params: [`ticker@${market}`] });

  return () => {
    manager.deRegisterCallback("ticker", callbackId);
    manager.sendMessage({
      method: "UNSUBSCRIBE",
      params: [`ticker@${market}`],
    });
  };
};

export const { updateTicker } = tickerSlice.actions;
export default tickerSlice.reducer;
