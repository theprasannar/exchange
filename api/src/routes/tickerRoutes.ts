
import express from 'express';
import { createOrderController, getDepthController } from '../controllers/orderController';
import { getTickerController } from '../controllers/tickerController';

const router = express.Router();

router.get('/:market', getTickerController);



export default router;

