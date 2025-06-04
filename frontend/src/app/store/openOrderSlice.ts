import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Order } from "../types/types";
import { getOpenOrders } from "../lib/api";
import { SignalingManager } from "../utils/SignalingManager";

type stateType = {
  openOrders: Order[];
  loading: boolean;
  error: string | null;
};

const initialState: stateType = {
  openOrders: [],
  loading: false,
  error: null,
};

export const fetchOpenOrders = createAsyncThunk(
  "openOrders/fetchOpenOrders",
  async (
    { market, userId }: { market: string; userId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await getOpenOrders(market, userId);
      //@ts-ignore
      const openOrders = response.orders;
      return { openOrders };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const openOrderSlice = createSlice({
  name: "openOrders",
  initialState,
  reducers: {
    updateOpenOrders: (state, action) => {
      const { orders } = action.payload;

      const normalizedOrders: Order[] = orders.map((o: any) => ({
        orderId: o.oI,
        side: o.s,
        price: o.p,
        quantity: o.q,
        filled: o.eQ,
        status: o.st,
        createdAt: new Date(o.t).toISOString(),
        userId: "",
      }));

      state.openOrders = normalizedOrders;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchOpenOrders.fulfilled, (state, action) => {
      state.openOrders = action.payload.openOrders;
    });
  },
});

export const { updateOpenOrders } = openOrderSlice.actions;

export const subscribeToOpenOrder =
  (market: string, userId: string) => (dispatch: any) => {
    const callbackId = `orders@${userId}`;
    const manager = SignalingManager.getInstance();
    manager.registerCallback(
      "openOrders",
      (msg) => {
        console.log("Received open orders", msg);
        const data = msg.data ?? msg.payload;
        dispatch(updateOpenOrders(data));
      },
      callbackId
    );

    manager.sendMessage({
      method: "SUBSCRIBE",
      params: [`orders@${userId}`],
    });
    return () => {
      manager.deRegisterCallback("openOrders", callbackId);
      manager.sendMessage({
        method: "UNSUBSCRIBE",
        params: [`Order_${userId}_${market}`],
      });
    };
  };

export default openOrderSlice.reducer;
