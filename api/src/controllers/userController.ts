import { GET_USER_BALANCE } from "./../types/messageToEngineTypes";
import { Request, Response } from "express";
import { RedisManager } from "../RedisManager";
import { atomicToBtc, atomicToUsdc } from "../utils/currency";

export const getUserBalanceController = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    const response = await RedisManager.getInstance().sendAndAwait(
      {
        type: GET_USER_BALANCE,
        data: { userId },
      },
      5000
    ); // 5 second timeout

    // Format the atomic values to display values
    //@ts-ignore
    const balances = response.payload;
    const formattedBalances = {
      USDC: {
        available: atomicToUsdc(balances.USDC.available),
        locked: atomicToUsdc(balances.USDC.locked),
      },
      BTC: {
        available: atomicToBtc(balances.BTC.available),
        locked: atomicToBtc(balances.BTC.locked),
      },
    };

    res.json(formattedBalances);
  } catch (error) {
    console.error("Error fetching user balance:", error);
    res.status(500).json({ error: "Failed to fetch user balance" });
  }
};
