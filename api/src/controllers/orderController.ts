import { Request, Response } from 'express';
import { enqueueOrder } from '../services/orderServices';

export const createOrderController = async (req: Request, res: Response): Promise<any> => {
  const { market, price, rate, quantity, side } = req.body;

  if (!market || !price || !rate || !quantity) {
    return res.status(400).json({ error: 'Invalid order parameters' });
  }

  try {
    await enqueueOrder(req.body);
    return res.status(200).json({ message: 'Order added successfully' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'Failed to add order' });
  }
};
