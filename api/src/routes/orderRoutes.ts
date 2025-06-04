import express from "express";
import {
  cancelOrderController,
  createOrderController,
  getDepthController,
  getOpenOrdersController,
} from "../controllers/orderController";

const router = express.Router();

router.post("/", createOrderController);
router.get("/open", getOpenOrdersController);
router.delete("/:orderId", cancelOrderController);
router.get("/depth/:market", getDepthController);

export default router;
