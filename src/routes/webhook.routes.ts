import express from "express";
import { Router } from "express";
import { handleWebhook } from "../controllers/webhook.controller";

// FIXME
// import authenticateToken from "../middleware/authenticateToken";

const router = Router();

router.post(
  "/",
  express.raw({ type: "application/json" }),
  // authenticateToken,
  handleWebhook
);

export default router;
