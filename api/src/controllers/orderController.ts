import { Request, Response } from 'express';
import { enqueueOrder } from '../services/orderServices';
import { RedisManager } from '../RedisManager';
import { CREATE_ORDER } from '../types';

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
  console.log('trt',response)
  //@ts-ignore
  res.json(response.payload);
};
