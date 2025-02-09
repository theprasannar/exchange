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
export async function getTrades(market: string): Promise<Trade[]> {
    const response = await axios.get(`${BASE_URL}/trades/${market}`);
    return response.data;
}

export async function getKlines(market: string, interval: string, startTime: number, endTime: number): Promise<KLine[]> {
    const response = await axios.get(`${BASE_URL}/klines?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`);
    const data: KLine[] = response.data;
    return data.sort((x, y) => (Number(x.end) < Number(y.end) ? -1 : 1));
}
