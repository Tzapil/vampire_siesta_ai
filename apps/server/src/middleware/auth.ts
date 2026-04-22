import type { Request, Response, NextFunction } from "express";
import { getAuthErrorMessage } from "../auth/errors";
import type { AuthService } from "../auth/service";
import type { RequestMeta } from "../auth/types";

export function getRequestMeta(req: Request): RequestMeta {
  return {
    ip: req.ip || undefined,
    userAgent: req.get("user-agent") ?? undefined
  };
}

export function attachRequestAuth(
  authService: AuthService,
  options?: {
    touchSession?: boolean;
    allowCookieRefresh?: boolean;
  }
) {
  return async function requestAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const resolution = await authService.resolveRequest(
        req.headers.cookie,
        getRequestMeta(req),
        options
      );

      req.auth = resolution.auth;

      if (resolution.clearCookie) {
        res.append("Set-Cookie", authService.createClearedSessionCookie());
      } else if (resolution.refreshCookie) {
        const sessionId = authService.readSessionIdFromCookieHeader(req.headers.cookie);
        if (sessionId) {
          res.append("Set-Cookie", authService.createSessionCookie(sessionId));
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ message: getAuthErrorMessage("unauthorized") });
    return;
  }

  next();
}
