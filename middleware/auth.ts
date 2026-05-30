import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Access denied. Token missing." });
  }

  const token = authHeader.split("Bearer ")[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    console.error("🔴 Token verification failed in auth middleware: invalid or expired token.");
    return res.status(401).json({ success: false, error: "Invalid or expired token." });
  }

  console.log("[AUTH_MIDDLEWARE] JWT Payload Decoded successfully:", {
    uid: decoded.uid,
    username: decoded.username,
    role: decoded.role,
    restaurantId: decoded.restaurantId,
    permissions: decoded.permissions
  });

  req.user = decoded;
  next();
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      console.log("BOOT_ERROR [ROLE_CHECK_FAIL] Request lacks user object");
      return res.status(401).json({ success: false, error: "Access denied. Unauthorized." });
    }

    const { role } = req.user;
    const userRole = (role || "").toUpperCase();
    const allowedRolesUpper = allowedRoles.map(r => r.toUpperCase());

    console.log("[ROLE_CHECK] Verifying role matches requirements:", {
      userRole,
      allowedRoles: allowedRolesUpper
    });

    if (userRole === "SUPER_ADMIN") {
      console.log("[ROLE_CHECK_SUCCESS] Bypassing restrictions for SUPER_ADMIN role");
      return next();
    }

    if (userRole === "SUPER_OWNER") {
      if (allowedRolesUpper.includes("SUPER_OWNER") || allowedRolesUpper.includes("OWNER") || allowedRolesUpper.includes("MANAGER") || allowedRolesUpper.includes("CAPTAIN")) {
        console.log("[ROLE_CHECK_SUCCESS] Permitting activity for SUPER_OWNER role");
        return next();
      }
    }

    if (allowedRolesUpper.includes(userRole)) {
      console.log("[ROLE_CHECK_SUCCESS] Permitted operational role:", userRole);
      return next();
    }

    console.log("BOOT_ERROR [ROLE_CHECK_FAIL] Role mismatch:", { userRole, allowedRoles: allowedRolesUpper });
    return res.status(403).json({ success: false, error: `Forbidden. Requires ${allowedRoles.join(" or ")} role.` });
  };
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      console.log("BOOT_ERROR [PERMISSION_CHECK_FAIL] Request lacks user context");
      return res.status(401).json({ success: false, error: "Access denied. Unauthorized." });
    }

    const { role, permissions } = req.user;
    const userRole = (role || "").toUpperCase();
    const userPermissions = permissions || [];

    console.log("[PERMISSION_CHECK] Evaluation started:", {
      userRole,
      required: permission,
      permissions: userPermissions
    });

    if (userRole === "SUPER_ADMIN" || userRole === "OWNER" || userRole === "SUPER_OWNER") {
      console.log("[PERMISSION_CHECK_SUCCESS] Privileged owner bypass resolved");
      return next();
    }

    if (userPermissions.includes(permission) || userPermissions.includes("all")) {
      console.log("[PERMISSION_CHECK_SUCCESS] Permission granted:", permission);
      return next();
    }

    console.log("BOOT_ERROR [PERMISSION_CHECK_FAIL] Missing required permission:", permission);
    return res.status(403).json({ success: false, error: `Forbidden. Missing permission: ${permission}` });
  };
};
