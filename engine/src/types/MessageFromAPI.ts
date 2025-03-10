export const CREATE_ORDER = 'CREATE_ORDER';
export const CANCEL_ORDER = 'CANCEL_ORDER';
export const ON_RAMP = 'ON_RAMP';
export const GET_DEPTH = 'GET_DEPTH';
export const GET_OPEN_ORDERS = 'GET_OPEN_ORDERS';
export const GET_TICKER_DETAILS = 'GET_TICKER_DETAILS'
export const GET_USER_BALANCE = 'GET_USER_BALANCE'


// Incoming messages from API to Engine:
export type MessageFromAPI =
  | {
      type: typeof CREATE_ORDER;
      data: {
        market: string;
        price: string;    // string representation of atomic price
        quantity: string; // string representation of atomic quantity
        side: "buy" | "sell";
        userId: string;
        orderType: "limit" | "market"
      };
    }
  | {
      type: typeof CANCEL_ORDER;
      data: {
        orderId: string;
        market: string;
      };
    }
  | {
      type: typeof ON_RAMP;
      data: {
        amount: string;
        userId: string;
        txnId: string;
      };
    }
  | {
      type: typeof GET_DEPTH;
      data: {
        market: string;
      };
    }
  | {
      type: typeof GET_OPEN_ORDERS;
      data: {
        market: string;
        userId: string;
      };
    }
  | {
    type: typeof GET_TICKER_DETAILS;
    data: {
      market: string;
    };
  }
  |
  {
    type: typeof GET_USER_BALANCE;
    data: {
      userId: string;
    };
  }
  ;
