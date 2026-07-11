import { Router, type IRouter } from "express";
import healthRouter from "./health";
import charactersRouter from "./characters";
import dreamsRouter from "./dreams";
import chatRouter from "./chat";
import aiRouter from "./ai";
import musicRouter from "./music";

const router: IRouter = Router();

router.use(healthRouter);
router.use(charactersRouter);
router.use(dreamsRouter);
router.use(chatRouter);
router.use(aiRouter);
router.use(musicRouter);

export default router;
