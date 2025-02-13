export const TRADE_ADDED = "TRADE_ADDED";
export const ORDER_UPDATE = "ORDER_UPDATE";

export type DbMessage = {
    type: typeof TRADE_ADDED;
    data: {
      market: string;
      id: string;
      isBuyerMaker: boolean;
      price: string; 
      quantity: string;
      quoteQuantity: string;
      timestamp: number;
    }
} | {
    type: "ORDER_UPDATE",
    data: {
        orderId: string,
        executedQty: string,
        market?: string,
        price?: string,
        quantity?: string,
        side?: "buy" | "sell",
    }
}
