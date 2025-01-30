import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getDepth } from "../lib/api"; // Assuming getDepth is correctly implemented
import { SignalingManager } from "../utils/SignalingManager";

type DepthState = {
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
  price: string | null;
};

const initialState: DepthState = {
  bids: [],
  asks: [],
  price: null,
};

// Async thunk to fetch initial depth data
export const fetchDepthData = createAsyncThunk(
  "depth/fetchDepthData",
  async (market: string, { rejectWithValue }) => {
    try {
      const depth = await getDepth(market);
      console.log('slice', depth);
      return { bids: depth.bids, asks: depth.asks, price: depth.c || null };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const depthSlice = createSlice({
  name: "depth",
  initialState,
  reducers: {
    updateDepth: (state, action: PayloadAction<{ bids: Array<[string, string]>; asks: Array<[string, string]>; price: string | null }>) => {
      const { bids, asks, price } = action.payload;

      // Update bids
      bids.forEach((bid: [string, string]) => {
        const index = state.bids.findIndex((b) => b[0] === bid[0]);
        if (index >= 0) {
          state.bids[index][1] = bid[1];
          if (Number(bid[1]) === 0) state.bids.splice(index, 1);
        } else if (Number(bid[1]) !== 0) {
          state.bids.push(bid);
        }
      });

      // Update asks
      asks.forEach((ask: [string, string]) => {
        const index = state.asks.findIndex((a) => a[0] === ask[0]);
        if (index >= 0) {
          state.asks[index][1] = ask[1];
          if (Number(ask[1]) === 0) state.asks.splice(index, 1);
        } else if (Number(ask[1]) !== 0) {
          state.asks.push(ask);
        }
      });

      // Update price if provided
      if (price !== null) {
        state.price = price;
      }

      // Sort bids and asks
      state.bids.sort((a, b) => Number(b[0]) - Number(a[0]));
      state.asks.sort((a, b) => Number(a[0]) - Number(b[0]));
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDepthData.fulfilled, (state, action) => {
        state.bids = action.payload.bids;
        state.asks = action.payload.asks;
        state.price = action.payload.price;
      })
      .addCase(fetchDepthData.pending, (state) => {
      })
      .addCase(fetchDepthData.rejected, (state, action) => {
        console.error("Failed to fetch depth data:", action.payload);
      });
  },
});

export const { updateDepth } = depthSlice.actions;

// Thunk to subscribe to depth updates
export const subscribeDepth = (market: string) => (dispatch: any) => {
  const manager = SignalingManager.getInstance();

  const callbackId = `Depth_${market}`;

  manager.registerCallback("DEPTH", (msg) => {
    const data = msg.data ?? msg.payload;
    dispatch(
      updateDepth({
        bids: data.b || [],
        asks: data.a || [],
        price: data.c || null,
      })
    );
  }, callbackId);

  manager.sendMessage({ method: "SUBSCRIBE", params: [`depth@${market}`] });

  return () => {
    manager.deRegisterCallback("DEPTH", callbackId);
    manager.sendMessage({ method: "UNSUBSCRIBE", params: [`depth@${market}`] });
  };
};

export default depthSlice.reducer;
