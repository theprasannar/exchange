import express from 'express'
import { getKlineData } from '../controllers/klineController';

const router = express.Router();

router.get('/', getKlineData)