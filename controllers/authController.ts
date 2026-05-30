import { Request, Response } from "express";
import { AuthService } from "../services/authService";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { restaurantCode, username, email, password } = req.body;
    const resolvedUser = username || email;

    if (!restaurantCode || !resolvedUser || !password) {
      return res.status(400).json({
        success: false,
        error: "restaurantCode, username/email, and password are all required."
      });
    }

    try {
      const result = await AuthService.login(restaurantCode, resolvedUser, password);
      return res.json({
        success: true,
        message: "Login successful.",
        ...result
      });
    } catch (err: any) {
      console.error("Login failure:", err.message);
      // Ensure specific database errors map perfectly to status 401 with correct messages
      return res.status(401).json({
        success: false,
        error: err.message || "Invalid credentials."
      });
    }
  }
}
