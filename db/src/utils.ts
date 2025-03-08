export const sleep = (time: any) => {
    return new Promise((resolve) => setTimeout(resolve, time));
}