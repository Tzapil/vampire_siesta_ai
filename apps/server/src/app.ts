import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { AuthError } from "./auth/errors";
import type { AuthService } from "./auth/service";
import { getAppConfig } from "./config";
import { createApiRouter } from "./routes/api";

export function createApp(authService: AuthService) {
  const config = getAppConfig();
  const app = express();

  app.set("trust proxy", true);

  if (config.allowedOrigins.length > 0) {
    app.use(
      cors({
        credentials: true,
        origin(origin, callback) {
          if (!origin || config.allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(new Error("Origin not allowed"));
        }
      })
    );
  }

  app.use(express.json({ limit: "15mb" }));

  app.use("/api", createApiRouter(authService));

  if (config.isProd) {
    app.use(express.static(config.clientDistPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(`${config.clientDistPath}/index.html`);
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (err instanceof AuthError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    res.status(500).json({ message: err.message || "Внутренняя ошибка сервера" });
  });

  return app;
}
