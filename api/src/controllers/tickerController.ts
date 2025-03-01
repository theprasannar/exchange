import { Request, Response } from 'express';
import { RedisManager } from '../RedisManager';
import {  GET_TICKER_DETAILS } from '../types';

export const getTickerController = async (req: Request, res: Response): Promise<any> => {
  const { market } = req.params;
  if (!market) {
    return res.status(400).json({ error: 'Market parameter is required' });
  }

  try {
    // Send a message to the engine requesting ticker data
    const response = await RedisManager.getInstance().sendAndAwait({
      type: GET_TICKER_DETAILS,
      data: { market }
    }, 5000); // 5-second timeout
    console.log(" response ~ response:", response)

    // Return the ticker data from the engine's response
    //@ts-ignore
    res.json(response.payload);
  } catch (error) {
    console.error('Error fetching ticker data:', error);
    res.status(500).json({ error: 'Failed to fetch ticker data' });
  }
};
