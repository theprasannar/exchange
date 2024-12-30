import { Fills, Order, OrderBook } from './orderBook';
import { RedisManager } from './redisManager';
import { MessageFromAPI } from './types/MessageFromAPI';

export const BASE_CURRENCY = "INR";

interface UserBalance {
    [key: string]: {
        available: number;
        locked: number;
    }
}

export class Engine {

    private orderBooks : OrderBook[] = [];
    private balance : Map<String, UserBalance> = new Map();

    constructor() {
        const btcInrOrderBook = new OrderBook('BTC', [], [], 'INR', 0, 0);
        this.orderBooks.push(btcInrOrderBook);
    
        // Initialize balances
        this.balance.set('user1', {
            INR: { available: 5000000, locked: 0 },
            BTC: { available: 0, locked: 0 },
        });
    
        this.balance.set('user2', {
            INR: { available: 0, locked: 0 },
            BTC: { available: 5, locked: 0 },
        });
    
        // Add a sell order from user2
        btcInrOrderBook.addOrder({
            price: 3000000, // Selling 1 BTC for 3,000,000 INR
            quantity: 1,
            side: 'sell',
            orderId: 'order2',
            filled: 0,
            userId: 'user2',
        });
    }
    
    

    process({message, clientId} : {message : MessageFromAPI, clientId: string})  {
        switch(message.type) {
            case "CREATE_ORDER" :
                try {
                    const {market, quantity, price, side, userId } = message.data;
                    const {executedQty, fills, orderId} = this.createOrder(market, quantity, price, side, userId)
                    RedisManager.getInstance().sendToApi(clientId, {
                        type: "ORDER_PLACED",
                        payload: {
                            orderId,
                            executedQty,
                            fills
                        }
                    })
                } catch (error) {
                    console.error(`Error processing CREATE_ORDER: ${error}`);
                    throw error; // Re-throw the error to handle it higher up
                }
            default:
                    console.error(`Unknown message type: ${message.type}`);
                    return null;
        }
    }

    getUserBalances() {
        console.log('User1 Balance:', this.balance.get('user1'));
        console.log('User2 Balance:', this.balance.get('user2'));
    }

    
    createOrder(market: string, quantity: string, price: string,  side: "buy"| "sell", userId: string) {

        //Check if orderBook Exist
        const orderbook = this.orderBooks.find(orderBook => orderBook.ticker() === market);
        if (!orderbook) {
            throw new Error(`No OrderBook found for ${market}`);
        }
        const baseAsset = market.split('_')[0];
        const quoteAssets = market.split('_')[1];

        this.checkAndLockFunds(baseAsset, quoteAssets, userId, price, side, quantity);

        //Now we have lock the funds and we can perform operation
        const order: Order = {
            price : Number(price),
            quantity : Number(quantity),
            orderId : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            filled : 0,
            side,
            userId
        }

        const {fills, executedQty} = orderbook.addOrder(order)
        this.updateBalance(userId, baseAsset, quoteAssets,  side, fills, executedQty );
        return { executedQty, fills, orderId: order.orderId };


    }
    checkAndLockFunds(baseAsset: string, quoteAssets: string, userId: string, price: string, side: "buy" | "sell", quantity: string) {
        if (side === "buy") {
            const userBalance = this.balance.get(userId)?.[quoteAssets]?.available || 0;
            if (userBalance < Number(price) * Number(quantity)) {
                throw new Error(`Insufficient balance for ${quoteAssets}`);
            }
            // Lock the funds
            this.balance.get(userId)![quoteAssets].available -= Number(price) * Number(quantity);
            this.balance.get(userId)![quoteAssets].locked += Number(price) * Number(quantity);
        } else {
            const userBalance = this.balance.get(userId)?.[baseAsset]?.available || 0;
            if (userBalance < Number(quantity)) {
                throw new Error(`Insufficient funds`);
            }
            // Lock the funds
            this.balance.get(userId)![baseAsset].available -= Number(quantity);
            this.balance.get(userId)![baseAsset].locked += Number(quantity);
        }
    }
    

    updateBalance(userId: string, baseAsset: string, quoteAsset: string, side: "buy"| "sell", fills: Fills[], executedQty:number) {
     
    if (side == "buy") {
        fills.forEach((order) => {
            //@ts-ignore
            this.balance.get(order.otherUserId)?.[quoteAsset]?.available = this.balance.get(order.otherUserId)?.[quoteAsset]?.available + order.amount * order.quantity;

            //@ts-ignore
            this.balance.get(userId)?.[quoteAsset]?.available = this.balance.get(userId)?.[quoteAsset]?.available - order.amount * order.quantity;

            //@ts-ignore
            this.balance.get(order.otherUserId)?.[baseAsset]?.available = this.balance.get(order.otherUserId)?.[baseAsset]?.available - order.quantity;

            //@ts-ignore
            this.balance.get(userId)?.[baseAsset]?.available = this.balance.get(userId)?.[baseAsset]?.available + order.quantity;
        });
    } else if (side == "sell") {
        fills.forEach((order) => {
            //@ts-ignore
            this.balance.get(order.otherUserId)?.[baseAsset]?.available = this.balance.get(order.otherUserId)?.[baseAsset]?.available + order.quantity;

            //@ts-ignore
            this.balance.get(userId)?.[baseAsset]?.available = this.balance.get(userId)?.[baseAsset]?.available - order.quantity;

            //@ts-ignore
            this.balance.get(order.otherUserId)?.[quoteAsset]?.available = this.balance.get(order.otherUserId)?.[quoteAsset]?.available - order.amount * order.quantity;

            //@ts-ignore
            this.balance.get(userId)?.[quoteAsset]?.available = this.balance.get(userId)?.[quoteAsset]?.available + order.amount * order.quantity;
        });
    }

    }
}