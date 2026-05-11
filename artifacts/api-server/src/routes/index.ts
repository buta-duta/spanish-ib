import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import examRouter from "./exam.js";
import listeningRouter from "./listening.js";
import readingRouter from "./reading.js";
import writingRouter from "./writing.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(examRouter);
router.use(listeningRouter);
router.use(readingRouter);
router.use(writingRouter);

export default router;
