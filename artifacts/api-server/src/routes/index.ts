import { Router, type IRouter } from "express";
import healthRouter from "./health";
import examRouter from "./exam";

const router: IRouter = Router();

router.use(healthRouter);
router.use(examRouter);

export default router;
