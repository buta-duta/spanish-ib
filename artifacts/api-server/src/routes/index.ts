import { Router, type IRouter } from "express";
import healthRouter from "./health";
import examRouter from "./exam";
import listeningRouter from "./listening";

const router: IRouter = Router();

router.use(healthRouter);
router.use(examRouter);
router.use(listeningRouter);

export default router;
