import { publishToQueue } from './redisServices';

export const enqueueOrder = async (order : any) => {
    try {
        await publishToQueue('orderQueue', order)
    } catch (error) {
        console.log('Failed to enqueue order')
        throw new Error('Faild to enqueue order')
    }
}