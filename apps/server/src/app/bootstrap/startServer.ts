import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAuthService } from "../../auth/service";
import { getAppConfig } from "../../config";
import { connectToDatabase } from "../../db/connection";
import { registerSocket } from "../../socket";
import { loadEnv } from "../../utils/loadEnv";
import { createApp } from "../http/createApp";

export async function startServer() {
  loadEnv();

  const config = getAppConfig();
  const authService = createAuthService(config);

  try {
    await connectToDatabase(config.mongoUrl);
  } catch (_error) {
    console.error("Не удалось подключиться к Mongo. Завершаем работу.");
    process.exit(1);
  }

  const app = createApp(authService);
  const server = http.createServer(app);
  const io = new SocketIOServer(
    server,
    config.allowedOrigins.length > 0
      ? {
          cors: {
            origin: config.allowedOrigins,
            credentials: true
          }
        }
      : {}
  );

  registerSocket(io, authService);

  server.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}
