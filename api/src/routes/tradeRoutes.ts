import express from "express";
import { getTrades } from "../controllers/tradeController";

const router = express.Router();

router.get("/", getTrades);

export default router;
