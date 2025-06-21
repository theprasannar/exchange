import { Order } from "../trade/orderBook";

// External order type for display (used in OPEN_ORDERS output)
export interface OrderDisplay {
  orderId: string;
  price: string;
  quantity: string;
  filled: string;
  side: "buy" | "sell";
  userId: string;
}

// Outgoing messages from Engine to API:
export type MessageToAPI =
  | {
      type: "DEPTH";
      payload: {
        bids: [string, string][];
        asks: [string, string][];
      };
    }
  | {
      type: "ORDER_PLACED";
      payload: {
        orderId: string;
        executedQty: string;
        fills: {
          price: string;
          quantity: string;
          tradeId: number;
        }[];
      };
    }
  | {
      type: "ORDER_REJECTED";
      payload: {
        reason: string;
      };
    }
  | {
      type: "ORDER_CANCELLED";
      payload: {
        orderId: string;
        executedQty: string;
        remainingQty: string;
      };
    }
  | {
      type: "OPEN_ORDERS";
      payload: OrderDisplay[];
    }
  | {
      type: "TICKER_UPDATE";
      payload: {
        currentPrice: string;
        high: string;
        low: string;
        volume: string;
        symbol?: string;
        high24h: string;
        low24h: string;
        volume24h: string;
        open24h: string;
        change24h: number;
      };
    }
  | {
      type: "GET_USER_BALANCE";
      payload: {
        [asset: string]: {
          available: bigint;
          locked: bigint;
        };
      };
    }
  | {
      type: "ERROR";
      payload: {
        error: string;
      };
    }
  | {
      type: "ON_RAMP_SUCCESS";
      payload: {
        userId: string;
        amount: string;
      };
    }
  | {
      type: "ON_RAMP_REJECTED";
      payload: {
        reason: string;
      };
    }
  | {
      type: "SYNC_USER_BALANCE";
      payload: {
        message: string;
      };
    }
  | {
      type: "SYNC_USER_BALANCE";
      payload: {
        message: string;
      };
    };
