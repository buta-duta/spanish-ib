import { Router, type IRouter } from "express";
import healthRouter from "./health";
import examRouter from "./exam";
import listeningRouter from "./listening";
import readingRouter from "./reading";
import writingRouter from "./writing";
import simplifyRouter from "./simplify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(examRouter);
router.use(listeningRouter);
router.use(readingRouter);
router.use(writingRouter);
router.use(simplifyRouter);

export default router;
