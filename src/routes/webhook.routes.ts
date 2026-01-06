import express from "express";
import { Router } from "express";
import { handleWebhook } from "../controllers/webhook.controller";

const router = Router();

router.post("/", express.raw({ type: "application/json" }), handleWebhook);

export default router;
