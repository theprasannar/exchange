import { ORDER_CREATE, ORDER_UPDATE, TRADE_ADDED } from "."

export type DbMessage = {
    type : typeof TRADE_ADDED
    data: {
        id: string,
        isBuyerMaker: boolean,
        price: string,
        quantity: string,
        quoteQuantity: string,
        timestamp: number,
        market: string
    }
} | {
    type: typeof ORDER_UPDATE,
    data: {
        orderId: string,
        executedQty: string,
        market?: string,
        price?: string,
        quantity?: string,
        side?: "buy" | "sell",
    }
} | {
    type: typeof ORDER_CREATE,
    data : {
        userId: string,
        market: string,
        side: "buy" | "sell",
        price: string,
        quantity: string,
        orderId: string,
        orderType: "limit" | "market",
    }
}
