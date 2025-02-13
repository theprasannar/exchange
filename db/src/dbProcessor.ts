import prisma from "./lib/prisma";
import {createClient} from 'redis'
import { DbMessage } from "./types";


async function main() {
    const redisClient = createClient();

    await redisClient.connect();

    console.log('Connected to redis ')
    while(true) {
        try {
            const response = await redisClient.brPop("db_processor", 0);
            if(!response) continue;

            const data : DbMessage = JSON.parse(response.element)

            if(data.type === "TRADE_ADDED") {
                await prisma.trade.create({
                    data: {
                        tradeId: Number(data.data.id),
                        market: data.data.market,
                        price: BigInt(data.data.price),
                        quantity: BigInt(data.data.quantity),
                        quoteQuantity: BigInt(data.data.quoteQuantity),
                        isBuyerMaker: data.data.isBuyerMaker,
                        timestamp: new Date(data.data.timestamp),
                    }
                })
            }

            if(data.type === "ORDER_UPDATE") {
                await prisma.order.update({
                    where: {id: data.data.orderId},
                    data: {
                        filled: BigInt(data.data.executedQty),
                        status: data.data.executedQty === data.data.quantity ? "FILLED" : "PARTIALLY_FILLED"
                    }
                })
            }
            
        } catch (error) {
            console.log("Error processing the message", error)
        }
    }
}

main().catch(console.error)