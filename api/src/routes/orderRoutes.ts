import express from 'express';
import { createOrderController } from '../controllers/orderController';

const router = express.Router();

router.post('/', createOrderController)

export default router;