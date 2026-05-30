import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "restopro_captain_app_secret_key_12345";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "restopro_captain_app_refresh_key_54321";

export interface TokenPayload {
  uid: string;
  username: string;
  role: string;
  restaurantId: string;
  branchId: string;
  permissions: string[];
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });
}

export function generateRefreshToken(payload: { uid: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export function verifyRefreshToken(token: string): { uid: string } | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { uid: string };
  } catch (err) {
    return null;
  }
}
