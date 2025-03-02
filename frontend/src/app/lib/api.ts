import axios from "axios";
import { Depth, KLine, Ticker, Trade } from "../types/types";
import { CreateOrder, CreateOrderResponse } from "../types/swap";

const BASE_URL = "http://localhost:4000/api/v1";


export async function getTicker(market: string) : Promise<Ticker> {
    const response = await axios.get(`${BASE_URL}/ticker/${market}`);
    return response.data;
}

export async function createOrder(order: CreateOrder): Promise<CreateOrderResponse> {
    const response = await axios.post(`${BASE_URL}/orders`, order);
    return response.data;
}
export async function getTickers(): Promise<Ticker[]> {
    const response = await axios.get(`${BASE_URL}/tickers`);
    return response.data;
}

export async function getDepth(market: string): Promise<Depth> {
    const response = await axios.get(`${BASE_URL}/orders/depth/${market}`);
    return response.data;
}
export async function getTrades(market: string, limit?: number): Promise<Trade[]> {
    const response = await axios.get(`${BASE_URL}/trades`, {
        params: { symbol: market, limit }
    });
    return response.data.trades.map((trade: any) => ({
        id: trade.tradeId,
        isBuyerMaker: trade.isBuyerMaker,
        price: trade.price,
        quantity: trade.quantity,
        quoteQuantity: trade.quoteQuantity,
        timestamp: trade.timestamp
    }));
}
export async function getKlines(market: string, interval: string, limit?: number): Promise<KLine[]> {
    const response = await axios.get(`${BASE_URL}/klines?symbol=${market}&interval=${interval}&limit=${limit}`);
    const data: KLine[] = response.data;
    return data;
}
export async function login(email: string, password: string)  {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
        email,
        password
    });
    const data = response.data;
    console.log(" signup ~ data:", data)
    return data;
}


export async function signup(email: string, password: string)  {
    const response = await axios.post(`${BASE_URL}/auth/signup`, {
        email,
        password
    });
    const data = response.data;
    return data;
}