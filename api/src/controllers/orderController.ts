import { Request, Response } from 'express';
import { RedisManager } from '../RedisManager';
import { CREATE_ORDER, GET_DEPTH } from '../types';

export const createOrderController = async (req: Request, res: Response): Promise<any> => {
  const { market, price, quantity, side, userId } = req.body;

  if (!market || !price || !side || !quantity) {
    return res.status(400).json({ error: 'Invalid order parameters' });
  }
  const response = await RedisManager.getInstance().sendAndAwait({
    type: CREATE_ORDER,
    data: {
      market,
      price,
      quantity,
      side,
      userId
    }
  }, 0);
  //@ts-ignore
  res.json(response.payload);
};

export const getDepthController = async (req: Request, res: Response): Promise<any> => {
  const { market } = req.params;

  if (!market) {
    return res.status(400).json({ error: 'Market parameter is required' });
  }

  try {
    const response = await RedisManager.getInstance().sendAndAwait({
      type: GET_DEPTH,
      data: { market }
    }, 5000); // 5 second timeout

    //@ts-ignore
    res.json(response.payload);
  } catch (error) {
    console.error('Error fetching market depth:', error);
    res.status(500).json({ error: 'Failed to fetch market depth' });
  }
};