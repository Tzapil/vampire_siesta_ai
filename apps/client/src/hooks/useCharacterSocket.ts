import { useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export type PatchPayload = {
  characterUuid: string;
  baseVersion: number;
  op: "set";
  path: string;
  value: unknown;
};

type PatchAppliedPayload = {
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
    onPatchApplied?: (payload: PatchAppliedPayload) => void;
    onResync?: (payload: ResyncPayload) => void;
    onReject?: (errors: Array<{ path: string; message: string }>) => void;
  }
) {
  const socketRef = useRef<Socket | null>(null);
  const onPatchAppliedRef = useRef(options?.onPatchApplied);
  const onResyncRef = useRef(options?.onResync);
  const onRejectRef = useRef(options?.onReject);

  useEffect(() => {
    onPatchAppliedRef.current = options?.onPatchApplied;
    onResyncRef.current = options?.onResync;
    onRejectRef.current = options?.onReject;
  }, [options?.onPatchApplied, options?.onResync, options?.onReject]);

  useEffect(() => {
    if (!uuid) return;

    const socket = io({ query: { uuid } });
    socketRef.current = socket;

    socket.on("patchApplied", (payload: PatchAppliedPayload) => {
      onPatchAppliedRef.current?.(payload);
    });

    socket.on("resync", (payload: ResyncPayload) => {
      onResyncRef.current?.(payload);
    });

    socket.emit("join", { uuid });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [uuid]);

  const sendPatch = useCallback((patch: PatchPayload) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("patch", patch, (response: any) => {
      if (!response?.ok) {
        onRejectRef.current?.(response?.errors || []);
        return;
      }
      if (response?.resync) {
        onResyncRef.current?.({ reason: "server-change" });
      }
    });
  }, []);

  return { sendPatch };
}
