import { Router } from "express";
import type { Response } from "express";
import { AuthError } from "../auth/errors";
import type { AuthService } from "../auth/service";
import { buildLoginRedirectPath } from "../auth/utils";
import { attachRequestAuth, getRequestMeta, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  function redirectToLogin(res: Response, error: unknown) {
    const errorCode = error instanceof AuthError ? error.code : "provider_error";
    res.redirect(buildLoginRedirectPath(errorCode));
  }

  router.get("/providers", (_req, res) => {
    res.json({ providers: authService.getEnabledProviders() });
  });

  router.get(
    "/google/start",
    asyncHandler(async (req, res) => {
      try {
        const redirectUrl = await authService.startAuthorization("google", req.query.next);
        res.redirect(redirectUrl);
      } catch (error) {
        redirectToLogin(res, error);
      }
    })
  );

  router.get(
    "/yandex/start",
    asyncHandler(async (req, res) => {
      try {
        const redirectUrl = await authService.startAuthorization("yandex", req.query.next);
        res.redirect(redirectUrl);
      } catch (error) {
        redirectToLogin(res, error);
      }
    })
  );

  router.get(
    "/google/callback",
    asyncHandler(async (req, res) => {
      try {
        const result = await authService.completeAuthorization(
          "google",
          req.query as Record<string, unknown>,
          getRequestMeta(req),
          authService.readSessionIdFromCookieHeader(req.headers.cookie)
        );
        res.append("Set-Cookie", authService.createSessionCookie(result.sessionId));
        res.redirect(result.redirectPath);
      } catch (error) {
        redirectToLogin(res, error);
      }
    })
  );

  router.get(
    "/yandex/callback",
    asyncHandler(async (req, res) => {
      try {
        const result = await authService.completeAuthorization(
          "yandex",
          req.query as Record<string, unknown>,
          getRequestMeta(req),
          authService.readSessionIdFromCookieHeader(req.headers.cookie)
        );
        res.append("Set-Cookie", authService.createSessionCookie(result.sessionId));
        res.redirect(result.redirectPath);
      } catch (error) {
        redirectToLogin(res, error);
      }
    })
  );

  router.get(
    "/me",
    attachRequestAuth(authService),
    asyncHandler(async (req, res) => {
      res.json({ user: req.auth?.user ?? null });
    })
  );

  router.post(
    "/logout",
    attachRequestAuth(authService, { allowCookieRefresh: false }),
    requireAuth,
    asyncHandler(async (req, res) => {
      await authService.logoutBySessionHash(req.auth!.sessionIdHash);
      res.append("Set-Cookie", authService.createClearedSessionCookie());
      res.json({ ok: true });
    })
  );

  router.patch(
    "/me",
    attachRequestAuth(authService),
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await authService.updateDisplayName(
        req.auth!.user.id,
        req.body?.displayName
      );
      res.json({ user });
    })
  );

  router.post(
    "/me/avatar",
    attachRequestAuth(authService),
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await authService.replaceAvatar(req.auth!.user.id, req.body?.dataUrl);
      res.json({ user });
    })
  );

  router.get(
    "/avatar/:userId",
    attachRequestAuth(authService),
    requireAuth,
    asyncHandler(async (req, res) => {
      const avatar = await authService.getAvatarPayload(req.params.userId);
      res.setHeader("Content-Type", avatar.mimeType);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(avatar.buffer);
    })
  );

  return router;
}
