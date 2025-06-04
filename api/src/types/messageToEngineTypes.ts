import {
  CREATE_ORDER,
  CANCEL_ORDER,
  ON_RAMP,
  GET_DEPTH,
  GET_OPEN_ORDERS,
  GET_TICKER_DETAILS,
  SYNC_USER_BALANCE,
} from "./index";
export const GET_USER_BALANCE = "GET_USER_BALANCE";

export type MessageToEngine =
  | {
      type: typeof CREATE_ORDER;
      data: {
        market: string;
        price: string;
        quantity: string;
        side: "buy" | "sell";
        userId: string;
        orderType?: "limit" | "market";
        ioc?: boolean;
        postOnly?: boolean;
      };
    }
  | {
      type: typeof CANCEL_ORDER;
      data: {
        orderId: string;
        market: string;
        userId: string;
      };
    }
  | {
      type: typeof ON_RAMP;
      data: {
        amount: string;
        userId: string;
        txnId: string;
      };
    }
  | {
      type: typeof GET_DEPTH;
      data: {
        market: string;
      };
    }
  | {
      type: typeof GET_OPEN_ORDERS;
      data: {
        market: string;
        userId: string;
      };
    }
  | {
      type: typeof GET_TICKER_DETAILS;
      data: {
        market: string;
      };
    }
  | {
      type: typeof GET_USER_BALANCE;
      data: {
        userId: string;
      };
    }
  | {
      type: typeof SYNC_USER_BALANCE;
      data: {
        userId: string;
      };
    };
