import { Order } from "../trade/orderBook"

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
export type MessageToAPI = {
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
    }
  }