import express from 'express';
import { createOrderController, getDepthController } from '../controllers/orderController';

const router = express.Router();

router.post('/', createOrderController);
router.get('/depth/:market', getDepthController);


export default router;