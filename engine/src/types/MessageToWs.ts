//TODO: Can we share the types between the ws layer and the engine?

export type TickerUpdateMessage = {
    stream: string, 
    data: {
        c?: string,
        h?: string,
        l?: string,
        v?: string,
        s?: string,
        id: number,
        e: "ticker"
    }
}


export type DepthUpdateMessage = {
    stream: string,
    data: {
        b?: [string, string][],
        a?: [string, string][],
        e: "depth"
    }
}

export type TradeAddedMessage = {
    stream: string,
    data: {
        e: "trade",
        t: number,
        m: boolean,
        p: string,
        q: string,
        s: string,
        T: number,
    }
}

export type KlineMessage = {
    stream: string,
    data: {
        e: "kline",
        o: string,
        h: string,
        l: string,
        c: string,
        v: string,
        t: string,
        sT: string,
        eT: string,
    }
}


export type WsMessage = TickerUpdateMessage | DepthUpdateMessage | TradeAddedMessage;
