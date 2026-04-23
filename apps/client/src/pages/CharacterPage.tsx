import { useCallback, useEffect, useMemo, useState } from "react";
import { setByPathImmutable } from "@siesta/shared";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { CharacterDto } from "../api/types";
import { GameMode } from "../components/GameMode";
import { Wizard } from "../components/Wizard";
import { useToast } from "../context/ToastContext";
import { useAppHeader } from "../context/AppHeaderContext";
import { useCharacterSocket } from "../hooks/useCharacterSocket";
import NotFound from "./NotFound";

export default function CharacterPage() {
  const { uuid } = useParams();
  const [character, setCharacter] = useState<CharacterDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { pushToast } = useToast();
  const { setActions } = useAppHeader();

  const fetchCharacter = useCallback(async () => {
    if (!uuid) return;
    try {
      const data = await api.get<CharacterDto>(`/characters/${uuid}`);
      setCharacter(data);
      setNotFound(false);
    } catch (err: any) {
      if (err?.status === 404) {
        setNotFound(true);
      } else {
        pushToast(err?.message ?? "Не удалось загрузить персонажа", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [uuid, pushToast]);

  useEffect(() => {
    fetchCharacter();
  }, [fetchCharacter]);

  const applyLocalPatch = useCallback((path: string, value: unknown) => {
    setCharacter((prev) => {
      if (!prev) return prev;
      return setByPathImmutable(prev, path, value);
    });
  }, []);

  const onPatchApplied = useCallback((payload: { path: string; value: unknown; version: number }) => {
    setCharacter((prev) => {
      if (!prev) return prev;
      const next = setByPathImmutable(prev, payload.path, payload.value);
      return { ...next, version: payload.version };
    });
  }, []);

  const onResync = useCallback(
    (payload?: { reason?: "rollback" | "server-change" }) => {
      if (payload?.reason === "rollback") {
        pushToast("Часть свободных очков была откатана из-за изменения бюджета", "info");
      } else {
        pushToast("Данные были обновлены сервером", "info");
      }
      fetchCharacter();
    },
    [fetchCharacter, pushToast]
  );

  const onReject = useCallback(
    (errors: Array<{ path: string; message: string }>) => {
      const message = errors?.[0]?.message || "Изменение отклонено сервером";
      pushToast(message, "error");
      fetchCharacter();
    },
    [fetchCharacter, pushToast]
  );

  const { sendPatch } = useCharacterSocket(uuid, {
    currentVersion: character?.version,
    onPatchApplied,
    onResync,
    onReject
  });

  const handlePatch = useCallback(
    (path: string, value: unknown) => {
      if (!character || !uuid) return;
      applyLocalPatch(path, value);
      sendPatch({
        characterUuid: uuid,
        op: "set",
        path,
        value
      });
    },
    [applyLocalPatch, character, sendPatch, uuid]
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      pushToast("Ссылка скопирована", "success");
    } catch {
      pushToast("Не удалось скопировать ссылку", "error");
    }
  }, [pushToast]);

  const handleExport = useCallback(async () => {
    if (!uuid) return;
    try {
      const data = await api.get<Record<string, unknown>>(`/characters/${uuid}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `character-${uuid}.json`;
      link.click();
      URL.revokeObjectURL(url);
      pushToast("Экспорт выполнен", "success");
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось экспортировать", "error");
    }
  }, [pushToast, uuid]);

  const characterUuid = character?.uuid;
  const headerActions = useMemo(() => {
    if (!characterUuid || !character?.creationFinished) {
      return null;
    }
    return (
      <>
        <button
          type="button"
          className="icon-button"
          title="Скопировать ссылку"
          aria-label="Скопировать ссылку"
          onClick={handleCopy}
        >
          🔗
        </button>
        <button
          type="button"
          className="icon-button"
          title="Экспорт JSON"
          aria-label="Экспорт JSON"
          onClick={handleExport}
        >
          ⤓
        </button>
        <Link
          to={`/c/${characterUuid}/st`}
          className="icon-button"
          title="Перейти в режим ведущего"
          aria-label="Перейти в режим ведущего"
        >
          🎲
        </Link>
      </>
    );
  }, [character?.creationFinished, characterUuid, handleCopy, handleExport]);

  useEffect(() => {
    setActions(headerActions);
    return () => setActions(null);
  }, [headerActions, setActions]);

  if (loading) {
    return (
      <section className="page">
        <h1>Персонаж</h1>
        <p>Загрузка…</p>
      </section>
    );
  }

  if (notFound || !character) {
    return <NotFound />;
  }

  return (
    <section className="page">
      {!character.creationFinished ? (
        <Wizard
          character={character}
          onPatch={handlePatch}
          onStepChange={(step, version) =>
            setCharacter((prev) =>
              prev
                ? {
                    ...prev,
                    wizard: { currentStep: step },
                    version: typeof version === "number" ? version : prev.version + 1
                  }
                : prev
            )
          }
          refresh={fetchCharacter}
        />
      ) : (
        <GameMode character={character} onPatch={handlePatch} />
      )}
    </section>
  );
}
