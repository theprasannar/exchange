export type WsMessage = {
    stream : string,
    data: {
        b? : [string, string] [],
        a? : [string, string] [],
        e : "depth"
    }
}