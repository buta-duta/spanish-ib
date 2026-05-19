import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz/ai", (_req, res) => {
  res.json({
    status: "ok",
    geminiKeyPresent: Boolean(process.env.GEMINI_API_KEY?.trim()),
    vercel: Boolean(process.env.VERCEL),
  });
});

export default router;
