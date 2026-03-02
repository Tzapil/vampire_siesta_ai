import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env")
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file });
      return file;
    }
  }

  dotenv.config();
  return null;
}
