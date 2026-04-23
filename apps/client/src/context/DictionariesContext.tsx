import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AggregatedDictionariesDto } from "../api/types";
import { fetchDictionaries } from "../features/dictionaries/api";

export type Dictionaries = AggregatedDictionariesDto;

type DictionariesContextValue = {
  dictionaries: Dictionaries;
};

const DictionariesContext = createContext<DictionariesContextValue | null>(null);

export function useDictionaries() {
  const ctx = useContext(DictionariesContext);
  if (!ctx) {
    throw new Error("Контекст справочников недоступен");
  }
  return ctx;
}

export function DictionariesProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dictionaries, setDictionaries] = useState<Dictionaries | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextDictionaries = await fetchDictionaries();
        if (!active) return;
        setDictionaries(nextDictionaries);
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Не удалось загрузить справочники");
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => {
    if (!dictionaries) return null;
    return { dictionaries };
  }, [dictionaries]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div>
          <h2>Загрузка справочников…</h2>
          <p>Пожалуйста, подождите.</p>
        </div>
      </div>
    );
  }

  if (error || !value) {
    return (
      <div className="loading-screen">
        <div>
          <h2>Не удалось загрузить справочники</h2>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return <DictionariesContext.Provider value={value}>{children}</DictionariesContext.Provider>;
}
