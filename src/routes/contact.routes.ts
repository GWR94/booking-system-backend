import { Router } from "express";
import { sendContactMessage } from "@controllers";

const router = Router();

router.post("/", sendContactMessage);

export default router;
