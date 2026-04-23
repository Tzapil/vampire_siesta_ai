import { Router } from "express";
import { getHomeScreen } from "../features/home/getHomeScreen";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/home",
  asyncHandler(async (req, res) => {
    const authUser = req.auth?.user;
    if (!authUser) {
      res.status(401).json({ message: "Требуется авторизация" });
      return;
    }

    res.json(await getHomeScreen(authUser.id));
  })
);

export default router;
