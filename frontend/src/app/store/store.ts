// ~/app/store/store.ts
import { configureStore } from "@reduxjs/toolkit";
import depthReducer from "./depthSlice";
import tickerReducer from "./tickerSlice";
import tradeReducer from "./tradeSlice";

const store = configureStore({
  reducer: {
    depth: depthReducer,
    ticker: tickerReducer,
    trade: tradeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
