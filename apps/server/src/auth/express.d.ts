import type { RequestAuthContext } from "./types";

declare global {
  namespace Express {
    interface Request {
      auth: RequestAuthContext | null;
    }
  }
}

export {};
