import { MessageFromAPI } from './types/MessageFromAPI';

export const BASE_CURRENCY = "INR";
export class Engine {

    public process({message, clientId} : {message : MessageFromAPI, clientId: string}): void  {
        switch(message.type) {
            case "CREATE_ORDER" :
                try {
                    console.log("Here we ame", message)
                } catch (error) {
                    
                }
        }
    }
}