import express from 'express';
import { getUserBalanceController } from '../controllers/userController';

const router = express.Router();

router.get('/balance/:userId', getUserBalanceController);

export default router; 