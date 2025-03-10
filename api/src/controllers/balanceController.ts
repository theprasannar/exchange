import { Request, Response } from 'express';
import { RedisManager } from '../RedisManager';
import { ON_RAMP } from '../types';
import { usdcToAtomic } from '../utils/currency';

export const onRampController = async (req: Request, res: Response): Promise<any> => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ error: 'User ID and amount are required' });
  }

  try {
    // Convert display amount to atomic units
    const atomicAmount = usdcToAtomic(amount);
    
    // Generate a unique transaction ID
    const txnId = `onramp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const response = await RedisManager.getInstance().sendAndAwait({
      type: ON_RAMP,
      data: {
        amount: atomicAmount.toString(),
        userId,
        txnId
      }
    }, 5000); // 5 second timeout

    // Check if response indicates an error
    //@ts-ignore
    if (response.type === "ON_RAMP_REJECTED") {
      return res.status(400).json({ 
        //@ts-ignore
        error: response.payload.reason || 'On-ramp rejected'
      });
    }
    //@ts-ignore
    else if (response.type === "ON_RAMP_SUCCESS") {
      return res.json({
        success: true,
        message: 'Funds added successfully',
        //@ts-ignore
        amount: response.payload.amount
      });
    }

    res.status(500).json({ error: 'Invalid response from engine' });
  } catch (error) {
    console.error('On-ramp error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process on-ramp'
    });
  }
};