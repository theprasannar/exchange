import Redis, {Redis as RedisClient} from 'ioredis'

const redisClient : RedisClient = new Redis({
    host: 'localhost',
    port: 6379
})

export const publishToQueue =  async (queue: string, message: any)=> {
    try {
       await redisClient.rpush(queue, JSON.stringify(message)) 
    } catch (error) {
        console.log('Error publishing message:')
        throw new Error('Error publishing message')
    }
}