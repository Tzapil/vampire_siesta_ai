import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { createApp } from "./app";
import { connectToDatabase } from "./db/connection";
import { registerSocket } from "./socket";
import { loadEnv } from "./utils/loadEnv";

loadEnv();

const port = Number(process.env.PORT) || 4000;

async function start() {
  try {
    await connectToDatabase(process.env.MONGO_URL);
  } catch (error) {
    console.error("Не удалось подключиться к Mongo. Завершаем работу.");
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*"
    }
  });

  registerSocket(io);

  server.listen(port, () => {
    console.log(`Server listening on порт ${port}`);
  });
}

start();

