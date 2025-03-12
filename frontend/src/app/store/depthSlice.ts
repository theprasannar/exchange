//@ts-nocheck
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getDepth } from "../lib/api"; // getDepth should return an object with keys: bids, asks, and price
import { SignalingManager } from "../utils/SignalingManager";
import { atomicToBtc, atomicToUsdc } from "../utils/currency";

// Define the shape of our depth state:
// Each bid/ask is exactly a tuple of two strings: [price, quantity]
type DepthState = {
  bids: [string, string][];
  asks: [string, string][];
  price: string | null;
};

const initialState: DepthState = {
  bids: [],
  asks: [],
  price: null,
};

// Async thunk to fetch initial depth data.
// It converts the raw (atomic) data to display values (USDC for price, BTC for quantity)
export const fetchDepthData = createAsyncThunk(
  "depth/fetchDepthData",
  async (market: string, { rejectWithValue }) => {
    try {
      const depth = await getDepth(market);
      return {
        bids: depth.bids.map(([p, q]: [string, string]): [string, string] => [
          atomicToUsdc(BigInt(p)), // Convert atomic USDC to display USDC
          atomicToBtc(BigInt(q))     // Convert atomic BTC to display BTC
        ]),
        asks: depth.asks.map(([p, q]: [string, string]): [string, string] => [
          atomicToUsdc(BigInt(p)),
          atomicToBtc(BigInt(q))
        ]),
        price: depth.price ? atomicToUsdc(BigInt(depth.price)) : null,
      };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const depthSlice = createSlice({
  name: "depth",
  initialState,
  reducers: {
    updateDepth: (
      state,
      action: PayloadAction<{ bids: [string, string][]; asks: [string, string][]; price: string | null }>
    ) => {
      const { bids, asks, price } = action.payload;

      // Update bids:
      bids.forEach((bid: [string, string]) => {
        const index = state.bids.findIndex((b) => b[0] === bid[0]);
        if (index >= 0) {
          state.bids[index][1] = bid[1];
          if (Number(bid[1]) === 0) state.bids.splice(index, 1);
        } else if (Number(bid[1]) !== 0) {
          state.bids.push(bid);
        }
      });

      // Update asks:
      asks.forEach((ask: [string, string]) => {
        const index = state.asks.findIndex((a) => a[0] === ask[0]);
        if (index >= 0) {
          state.asks[index][1] = ask[1];
          if (Number(ask[1]) === 0) state.asks.splice(index, 1);
        } else if (Number(ask[1]) !== 0) {
          state.asks.push(ask);
        }
      });

      // Update price if provided:
      if (price !== null) {
        state.price = price;
      }

      // Sort bids descending and asks ascending (by price)
      state.bids.sort((a, b) => Number(b[0]) - Number(a[0]));
      state.asks.sort((a, b) => Number(a[0]) - Number(b[0]));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepthData.fulfilled, (state, action) => {
        console.log("action.payload", action.payload);
        state.bids = action.payload.bids;
        state.asks = action.payload.asks;
        state.price = action.payload.price;
      })
      .addCase(fetchDepthData.pending, (state) => {})
      .addCase(fetchDepthData.rejected, (state, action) => {
        console.error("Failed to fetch depth data:", action.payload);
      });
  },
});

export const { updateDepth } = depthSlice.actions;

// Thunk to subscribe to depth updates via the SignalingManager.
// This converts incoming atomic data (if needed) to display values.
export const subscribeDepth = (market: string) => (dispatch: any) => {
  const manager = SignalingManager.getInstance();
  const callbackId = `Depth_${market}`;

  manager.registerCallback("depth", (msg) => {
    console.log("Received depth update:", msg);
    const data = msg.data ?? msg.payload;
    // Convert incoming data if it is still in atomic form:
    const bids = (data.b || []).map(([p, q]: [string, string]): [string, string] => [
      atomicToUsdc(BigInt(p)),
      atomicToBtc(BigInt(q))
    ]);
    const asks = (data.a || []).map(([p, q]: [string, string]): [string, string] => [
      atomicToUsdc(BigInt(p)),
      atomicToBtc(BigInt(q))
    ]);
    dispatch(
      updateDepth({
        bids,
        asks,
        price: data.c ? atomicToUsdc(BigInt(data.c)) : null,
      })
    );
  }, callbackId);

  manager.sendMessage({ method: "SUBSCRIBE", params: [`depth@${market}`] });

  return () => {
    manager.deRegisterCallback("depth", callbackId);
    manager.sendMessage({ method: "UNSUBSCRIBE", params: [`depth@${market}`] });
  };
};

export default depthSlice.reducer;
