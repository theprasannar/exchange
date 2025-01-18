// ~/app/store/depthSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getDepth, getTicker } from "../lib/api";

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
export const fetchDepthData = createAsyncThunk(
    "depth/fetchDepthData",
    async (market: string) => {
        const depth = await getDepth(market);
        const ticker = await getTicker(market);
        return { bids: depth.bids.reverse(), asks: depth.asks, price: ticker.lastPrice };
    }
);
const depthSlice = createSlice({
  name: "depth",
  initialState,
  reducers: {
    updateDepth: (state, action: PayloadAction<DepthState>) => {
      state.bids = action.payload.bids;
      state.asks = action.payload.asks;
    },
  },
});

export const { updateDepth } = depthSlice.actions;
export default depthSlice.reducer;

/*


// Thunk to fetch initial depth data
export const fetchDepthData = createAsyncThunk(
    "depth/fetchDepthData",
    async (market: string) => {
        const depth = await getDepth(market);
        const ticker = await getTicker(market);
        return { bids: depth.bids.reverse(), asks: depth.asks, price: ticker.lastPrice };
    }
);

const depthSlice = createSlice({
    name: "depth",
    initialState,
    reducers: {
        updateDepth: (state, action) => {
            const { bids, asks } = action.payload;

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

            // Sort bids and asks
            state.bids.sort((a, b) => Number(b[0]) - Number(a[0]));
            state.asks.sort((a, b) => Number(a[0]) - Number(b[0]));
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchDepthData.fulfilled, (state, action) => {
            state.bids = action.payload.bids;
            state.asks = action.payload.asks;
            state.price = action.payload.price;
        });
    },
});

export const { updateDepth } = depthSlice.actions;

export const subscribeDepth = (market: string) => async (dispatch: any) => {
    const manager = SignalingManager.getInstance();

    manager.onMessage((msg: any) => {
        if (msg.type === "DEPTH") {
            dispatch(updateDepth(msg.payload));
        }
    });

    manager.sendMessage({ method: "SUBSCRIBE", params: [`depth@${market}`] });
};

export const unsubscribeDepth = (market: string) => () => {
    const manager = SignalingManager.getInstance();
    manager.sendMessage({ method: "UNSUBSCRIBE", params: [`depth@${market}`] });
};

export default depthSlice.reducer;

 */