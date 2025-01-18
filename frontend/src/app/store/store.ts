// ~/app/store/store.ts
import { configureStore } from "@reduxjs/toolkit";
import depthReducer from "./depthSlice";
// import tickerReducer from "./tickerSlice";
// import tradesReducer from "./tradesSlice";

const store = configureStore({
  reducer: {
    depth: depthReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
