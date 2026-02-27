import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import apiRouter from "./routes/api";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", apiRouter);

  const isProd = process.env.NODE_ENV === "production";
  const clientDistPath = process.env.CLIENT_DIST_PATH || path.resolve(process.cwd(), "apps/client/dist");

  if (isProd) {
    app.use(express.static(clientDistPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: err.message || "Внутренняя ошибка сервера" });
  });

  return app;
}
