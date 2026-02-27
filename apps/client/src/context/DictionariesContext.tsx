import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type {
  AbilityDto,
  AttributeDto,
  ClanDto,
  DictItem,
  FlawDto,
  GenerationDto,
  MeritDto
} from "../api/types";

export type Dictionaries = {
  clans: ClanDto[];
  disciplines: DictItem[];
  attributes: AttributeDto[];
  abilities: AbilityDto[];
  backgrounds: DictItem[];
  virtues: DictItem[];
  merits: MeritDto[];
  flaws: FlawDto[];
  sects: DictItem[];
  natures: DictItem[];
  demeanors: DictItem[];
  generations: GenerationDto[];
};

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
        const [
          clans,
          disciplines,
          attributes,
          abilities,
          backgrounds,
          virtues,
          merits,
          flaws,
          sects,
          natures,
          demeanors,
          generations
        ] = await Promise.all([
          api.get<ClanDto[]>("/clans"),
          api.get<DictItem[]>("/disciplines"),
          api.get<AttributeDto[]>("/attributes"),
          api.get<AbilityDto[]>("/abilities"),
          api.get<DictItem[]>("/backgrounds"),
          api.get<DictItem[]>("/virtues"),
          api.get<MeritDto[]>("/merits"),
          api.get<FlawDto[]>("/flaws"),
          api.get<DictItem[]>("/sects"),
          api.get<DictItem[]>("/natures"),
          api.get<DictItem[]>("/demeanors"),
          api.get<GenerationDto[]>("/generations")
        ]);

        if (!active) return;
        setDictionaries({
          clans,
          disciplines,
          attributes,
          abilities,
          backgrounds,
          virtues,
          merits,
          flaws,
          sects,
          natures,
          demeanors,
          generations
        });
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Не удалось загрузить справочники");
        setLoading(false);
      }
    }

    load();
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
