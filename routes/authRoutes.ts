import { Router } from "express";
import { AuthController } from "../controllers/authController";

const router = Router();

router.post("/login", AuthController.login);

router.get("/login", (req, res) => {
  res.status(405).json({
    success: false,
    error: "Method Not Allowed. Use POST instead of GET to log in."
  });
});

export default router;
