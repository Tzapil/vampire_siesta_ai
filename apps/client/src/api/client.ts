import type { ApiErrorPayload } from "./types";

const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  errors?: Array<{ path: string; message: string }>;

  constructor(message: string, status: number, errors?: Array<{ path: string; message: string }>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    ...options
  });

  const data = (await parseJson(res)) as ApiErrorPayload | T | null;

  if (!res.ok) {
    const message = (data as ApiErrorPayload)?.message || "Ошибка запроса";
    const errors = (data as ApiErrorPayload)?.errors;
    throw new ApiError(message, res.status, errors);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined
    }),
  del: <T>(path: string) =>
    apiRequest<T>(path, {
      method: "DELETE"
    })
};
