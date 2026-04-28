import { useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export type PatchPayload = {
  characterUuid: string;
  op: "set";
  path: string;
  value: unknown;
  baseVersion?: number;
};

type PatchAppliedPayload = {
  characterUuid: string;
  path: string;
  value: unknown;
  version: number;
};

type PatchConfirmedPayload = {
  characterUuid: string;
  path: string;
  value: unknown;
  version: number;
};

type ResyncPayload = {
  reason?: "rollback" | "server-change";
};

export function useCharacterSocket(
  uuid: string | undefined,
  options?: {
    currentVersion?: number;
    onPatchApplied?: (payload: PatchAppliedPayload) => void;
    onPatchConfirmed?: (payload: PatchConfirmedPayload) => void;
    onResync?: (payload: ResyncPayload) => void;
    onReject?: (errors: Array<{ path: string; message: string }>) => void;
  }
) {
  const notifyUnauthorized = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("vs:auth-unauthorized"));
    }
  }, []);
  const socketRef = useRef<Socket | null>(null);
  const onPatchAppliedRef = useRef(options?.onPatchApplied);
  const onPatchConfirmedRef = useRef(options?.onPatchConfirmed);
  const onResyncRef = useRef(options?.onResync);
  const onRejectRef = useRef(options?.onReject);
  const versionRef = useRef<number | null>(options?.currentVersion ?? null);
  const pendingRef = useRef(false);
  const queueRef = useRef<Array<Omit<PatchPayload, "baseVersion">>>([]);

  useEffect(() => {
    if (typeof options?.currentVersion === "number") {
      versionRef.current = options.currentVersion;
    }
  }, [options?.currentVersion]);

  useEffect(() => {
    onPatchAppliedRef.current = options?.onPatchApplied;
    onPatchConfirmedRef.current = options?.onPatchConfirmed;
    onResyncRef.current = options?.onResync;
    onRejectRef.current = options?.onReject;
  }, [options?.onPatchApplied, options?.onPatchConfirmed, options?.onResync, options?.onReject]);

  useEffect(() => {
    if (!uuid) return;

    const socket = io({
      query: { uuid },
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on("patchApplied", (payload: PatchAppliedPayload) => {
      versionRef.current = payload.version;
      onPatchAppliedRef.current?.(payload);
    });

    socket.on("resync", (payload: ResyncPayload) => {
      pendingRef.current = false;
      queueRef.current = [];
      onResyncRef.current?.(payload);
    });

    socket.on("auth:error", notifyUnauthorized);
    socket.on("connect_error", (error) => {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("unauthorized") || message.includes("автор")) {
        notifyUnauthorized();
      }
    });

    socket.emit("join", { uuid });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [notifyUnauthorized, uuid]);

  const emitNext = useCallback(() => {
    if (pendingRef.current) return;
    const socket = socketRef.current;
    if (!socket) return;

    const next = queueRef.current.shift();
    if (!next) return;

    const baseVersion = versionRef.current;
    if (typeof baseVersion !== "number") {
      onRejectRef.current?.([{ path: "version", message: "Не удалось определить версию" }]);
      queueRef.current = [];
      return;
    }

    pendingRef.current = true;
    socket.emit("patch", { ...next, baseVersion }, (response: any) => {
      if (!response?.ok) {
        pendingRef.current = false;
        queueRef.current = [];
        onRejectRef.current?.(response?.errors || []);
        return;
      }

      if (typeof response?.newVersion === "number") {
        versionRef.current = response.newVersion;
        onPatchConfirmedRef.current?.({
          characterUuid: next.characterUuid,
          path: next.path,
          value: next.value,
          version: response.newVersion
        });
      }
      pendingRef.current = false;
      if (response?.resync) {
        onResyncRef.current?.({ reason: "server-change" });
        return;
      }
      emitNext();
    });
  }, []);

  const sendPatch = useCallback((patch: PatchPayload) => {
    const { characterUuid, op, path, value } = patch;
    queueRef.current.push({ characterUuid, op, path, value });
    emitNext();
  }, [emitNext]);

  return { sendPatch };
}
