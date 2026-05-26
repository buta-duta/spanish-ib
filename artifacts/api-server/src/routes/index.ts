import { Router, type IRouter } from "express";
import { requireSiteAuth } from "../middleware/requireSiteAuth";
import authRouter from "./auth";
import healthRouter from "./health";
import examRouter from "./exam";
import listeningRouter from "./listening";
import readingRouter from "./reading";
import writingRouter from "./writing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireSiteAuth);
router.use(examRouter);
router.use(listeningRouter);
router.use(readingRouter);
router.use(writingRouter);

export default router;
