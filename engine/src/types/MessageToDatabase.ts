import { ORDER_UPDATE, TRADE_ADDED } from "."

export type DbMessage = {
    type : typeof TRADE_ADDED
    data: {
        id: string,
        isBuyerMaker: boolean,
        price: number,
        quantity: string,
        quoteQuantity: string,
        timestamp: number,
        market: string
    }
} | {
    type: typeof ORDER_UPDATE,
    data: {
        orderId: string,
        executedQty: number,
        market?: string,
        price?: number,
        quantity?: string,
        side?: "buy" | "sell",
    }
}
