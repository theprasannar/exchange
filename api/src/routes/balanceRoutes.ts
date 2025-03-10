import express from 'express';
import { onRampController } from '../controllers/balanceController';

const router = express.Router();

router.post('/onramp', onRampController);

export default router; 