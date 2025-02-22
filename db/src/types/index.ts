export const TRADE_ADDED = "TRADE_ADDED";
export const ORDER_UPDATE = "ORDER_UPDATE";
export const ORDER_CREATE = "ORDER_CREATE";

export type TradeAddedData = {
  market: string;
  id: string;
  isBuyerMaker: boolean;
  price: string;
  quantity: string;
  quoteQuantity: string;
  timestamp: number;
  makerOrderId?: string;
  takerOrderId?: string;
  makerUserId?: string;
  takerUserId?: string;
};

export type OrderUpdateData = {
  orderId: string;
  executedQty: string;
  market: string;
  price?: string;
  quantity?: string;
  side: "buy" | "sell";
  status: "PENDING" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
};

export type OrderCreateData = {
  orderId: string;
  userId: string;
  executedQty: string;
  market: string;
  price: string;
  quantity: string;
  side: "buy" | "sell";
  status?: "PENDING" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED";
};



export type DbMessage =
  | {
    type: typeof TRADE_ADDED;
    data: TradeAddedData;
  }
  | {
    type: typeof ORDER_UPDATE;
    data: OrderUpdateData;
  }
  | {
    type: typeof ORDER_CREATE;
    data: OrderCreateData;
  };
