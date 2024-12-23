import { createClient, RedisClientType } from 'redis';
import { Engine } from './engine';

async function main() {
    const engine = new Engine();
    const redisClient = createClient()
    redisClient.connect();
    console.log('Successfully connected')

    while (true) {
        const message = await redisClient.brPop('message', 0);

        if (message) {
            console.log("main ~ message:", message)
            
            try {
                // Use object destructuring
                const { element } = message; 
                const parsedPayload = JSON.parse(element);
        
                const { clientId, message: orderMessage } = parsedPayload;
        
                const response = engine.process(parsedPayload);
        
                await redisClient.publish(clientId, JSON.stringify({
                    status: "success",
                    data: response
                }));
        
            } catch (error) {
                console.error('Failed to process message:', message, error);
            }
        } else {
            console.warn('No message received.');
        }
        
    }
}

main();