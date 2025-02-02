export interface CreateOrder {
    market: string;
    price: string;
    quantity: string;
    side: "buy" | "sell";
    userId?: string;

}

export interface Fill {
    price: string;
    quantity: string;
    tradeId: number;
}

export interface CreateOrderResponse {
    orderId: string;
    executedQty: string;
    fills: Fill[];
}
