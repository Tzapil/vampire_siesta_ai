import { setByPathImmutable } from "@siesta/shared";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { NpcDto, NpcInputDto } from "../api/types";
import { api } from "../api/client";
import { HealthTrack } from "../components/HealthTrack";
import { HelpPopoverGroup } from "../components/HelpPopover";
import { NpcTraitSection } from "../components/NpcTraitSection";
import { useDictionaries } from "../context/DictionariesContext";
import { useToast } from "../context/ToastContext";
import NotFound from "./NotFound";
import { clampNpcHealth, clampNpcNumber, createEmptyNpcInput, toNpcInput } from "../utils/npc";

export default function NpcEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { dictionaries } = useDictionaries();
  const { pushToast } = useToast();
  const [form, setForm] = useState<NpcInputDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>([]);
  const traitEditMode = isEdit ? "buttons" : "dots";
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      setErrors([]);
      if (!isEdit || !id) {
        if (active) {
          setForm(createEmptyNpcInput(dictionaries));
          setNotFound(false);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await api.get<NpcDto>(`/npcs/${id}`);
        if (!active) return;
        setForm(toNpcInput(data, dictionaries));
        setNotFound(false);
      } catch (err: any) {
        if (!active) return;
        if (err?.status === 404) {
          setNotFound(true);
          return;
        }
        pushToast(err?.message ?? "Не удалось загрузить NPC", "error");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [dictionaries, id, isEdit, pushToast]);

  const updateForm = (path: string, value: unknown) => {
    setForm((prev) => (prev ? setByPathImmutable(prev, path, value) : prev));
  };

  const handleTraitChange = (
    group: keyof NpcInputDto["traits"],
    key: string,
    next: number
  ) => {
    updateForm(`traits.${group}.${key}`, next);
  };

  const handleResourceChange = (path: string, value: number, min: number, max: number) => {
    updateForm(path, clampNpcNumber(value, min, max));
  };

  const handleAvatarFile = (file?: File | null) => {
    if (!file) return;
    const maxBytes = 2_000_000;
    if (file.size > maxBytes) {
      pushToast("Файл слишком большой (макс. 2 МБ)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        pushToast("Не удалось прочитать файл", "error");
        return;
      }
      updateForm("meta.avatarUrl", result);
    };
    reader.onerror = () => {
      pushToast("Не удалось прочитать файл", "error");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.meta.name.trim()) {
      setErrors([{ path: "meta.name", message: "Имя обязательно" }]);
      pushToast("Имя NPC обязательно", "error");
      return;
    }

    setSaving(true);
    setErrors([]);

    const payload: NpcInputDto = {
      ...form,
      resources: {
        ...form.resources,
        health: clampNpcHealth(form.resources.health)
      }
    };

    try {
      const saved = isEdit && id
        ? await api.put<NpcDto>(`/npcs/${id}`, payload)
        : await api.post<NpcDto>("/npcs", payload);
      pushToast(isEdit ? "NPC сохранён" : "NPC создан", "success");
      navigate(`/npcs/${saved.id}`);
    } catch (err: any) {
      setErrors(err?.errors ?? []);
      pushToast(err?.message ?? "Не удалось сохранить NPC", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="page">
        <h1>{isEdit ? "Редактирование NPC" : "Создание NPC"}</h1>
        <p>Загрузка…</p>
      </section>
    );
  }

  if (notFound || !form) {
    return <NotFound />;
  }

  const avatarUrl = form.meta.avatarUrl?.trim();
  return (
    <HelpPopoverGroup>
      <section className="page npc-editor-page">
        <div className="card npc-editor-hero">
          <div className="card-header st-header npc-editor-hero-header">
            <div className="card-header-main npc-editor-title-block">
              <div className="npc-editor-eyebrow">
                {isEdit ? "Каталог NPC" : "Новый профиль"}
              </div>
              <div className="section-title">{isEdit ? "Редактирование NPC" : "Создание NPC"}</div>
              <p className="npc-editor-subtitle">
                Быстрый профиль для сцен и боя: образ, ключевые черты, ресурсы и рабочие заметки.
              </p>
            </div>
            <div className="page-actions header-actions">
              <Link
                to={isEdit && id ? `/npcs/${id}` : "/npcs"}
                className="icon-button"
                title="Назад"
              >
                ←
              </Link>
              <button
                type="button"
                className="primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="error-list">
            {errors.map((error, index) => (
              <div key={`${error.path}-${index}`}>{error.message}</div>
            ))}
          </div>
        )}

        <div className="card npc-editor-identity-card">
          <div className="npc-editor-section-head">
            <div>
              <div className="section-title">Основа</div>
              <p>Имя, образ и принадлежность NPC для списка хроники и боевых сцен.</p>
            </div>
          </div>
          <div className="npc-editor-identity-grid">
            <div className="npc-editor-avatar-panel">
              <span className="npc-editor-avatar-label">Аватар</span>
              <div className={`sheet-avatar-frame npc-editor-avatar-frame ${avatarUrl ? "" : "empty"}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Аватар NPC" />
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    Загрузить
                  </button>
                )}
                <button
                  type="button"
                  className="icon-button avatar-edit"
                  title={avatarUrl ? "Изменить" : "Загрузить"}
                  aria-label={avatarUrl ? "Изменить" : "Загрузить"}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  ✎
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    handleAvatarFile(file);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
            <div className="npc-editor-main-fields">
              <label className="field npc-editor-name-field">
                <span>Имя</span>
                <input
                  value={form.meta.name}
                  onChange={(event) => updateForm("meta.name", event.target.value)}
                  placeholder="Например, Шериф Элизиума"
                />
              </label>
              <label className="field">
                <span>Клан</span>
                <select
                  value={form.meta.clanKey ?? ""}
                  onChange={(event) => updateForm("meta.clanKey", event.target.value)}
                >
                  <option value="">Без клана</option>
                  {dictionaries.clans.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.labelRu}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Секта</span>
                <select
                  value={form.meta.sectKey ?? ""}
                  onChange={(event) => updateForm("meta.sectKey", event.target.value)}
                >
                  <option value="">Без секты</option>
                  {dictionaries.sects.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.labelRu}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Поколение</span>
                <select
                  value={form.meta.generation ?? ""}
                  onChange={(event) =>
                    updateForm(
                      "meta.generation",
                      event.target.value ? Number(event.target.value) : null
                    )
                  }
                >
                  <option value="">Не указано</option>
                  {dictionaries.generations.map((item) => (
                    <option key={item.generation} value={item.generation}>
                      {item.generation}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="card npc-editor-traits-card">
          <div className="npc-editor-section-head">
            <div>
              <div className="section-title">Черты</div>
              <p>
                Соберите игровой профиль без полного листа персонажа. На создании значения ставятся
                кликами по точкам.
              </p>
            </div>
          </div>
          <div className="npc-editor-traits-layout">
            <div className="npc-editor-traits-column npc-editor-traits-column-compact">
              <NpcTraitSection
                title="Атрибуты"
                items={dictionaries.attributes}
                values={form.traits.attributes}
                min={1}
                max={5}
                editable
                editMode={traitEditMode}
                onChange={(key, next) => handleTraitChange("attributes", key, next)}
              />
              <NpcTraitSection
                title="Добродетели"
                items={dictionaries.virtues}
                values={form.traits.virtues}
                min={1}
                max={5}
                editable
                editMode={traitEditMode}
                onChange={(key, next) => handleTraitChange("virtues", key, next)}
              />
            </div>
            <NpcTraitSection
              title="Способности"
              items={dictionaries.abilities}
              values={form.traits.abilities}
              min={0}
              max={5}
              editable
              editMode={traitEditMode}
              onChange={(key, next) => handleTraitChange("abilities", key, next)}
            />
            <NpcTraitSection
              title="Дисциплины"
              items={dictionaries.disciplines}
              values={form.traits.disciplines}
              min={0}
              max={5}
              editable
              editMode={traitEditMode}
              onChange={(key, next) => handleTraitChange("disciplines", key, next)}
            />
          </div>
        </div>

        <div className="npc-editor-bottom-grid">
          <div className="card npc-editor-resources-card">
            <div className="npc-editor-section-head">
              <div>
                <div className="section-title">Ресурсы</div>
                <p>Текущие значения для крови, силы воли, человечности и здоровья.</p>
              </div>
            </div>
            <div className="npc-resource-grid npc-editor-resource-grid">
              <label className="field npc-stat-card npc-editor-resource-card">
                <span className="npc-stat-label">Кровь</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={form.resources.bloodPool.current}
                  onChange={(event) =>
                    handleResourceChange(
                      "resources.bloodPool.current",
                      Number(event.target.value),
                      0,
                      50
                    )
                  }
                />
                <small>Текущий запас vitae.</small>
              </label>
              <label className="field npc-stat-card npc-editor-resource-card">
                <span className="npc-stat-label">Сила воли</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.resources.willpower.current}
                  onChange={(event) =>
                    handleResourceChange(
                      "resources.willpower.current",
                      Number(event.target.value),
                      0,
                      10
                    )
                  }
                />
                <small>Используется как текущее значение, не максимум.</small>
              </label>
              <label className="field npc-stat-card npc-editor-resource-card">
                <span className="npc-stat-label">Человечность</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.resources.humanity.current}
                  onChange={(event) =>
                    handleResourceChange(
                      "resources.humanity.current",
                      Number(event.target.value),
                      0,
                      10
                    )
                  }
                />
                <small>Можно использовать для морального тона сцены.</small>
              </label>
              <div className="npc-stat-card npc-health-card npc-editor-resource-card npc-editor-health-card">
                <span className="npc-stat-label">Здоровье</span>
                <HealthTrack
                  health={form.resources.health}
                  onChange={(next) => updateForm("resources.health", clampNpcHealth(next))}
                />
              </div>
            </div>
          </div>

          <div className="card npc-editor-notes-card">
            <div className="npc-editor-section-head">
              <div>
                <div className="section-title">Заметки</div>
                <p>Сцены, мотивация, связи, характерные реплики и быстрые подсказки для сторителлера.</p>
              </div>
            </div>
            <label className="field">
              <textarea
                className="npc-editor-notes"
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={10}
                placeholder="Сцены, мотивация, связи, реплики, заготовки для боя."
              />
            </label>
          </div>
        </div>
      </section>
    </HelpPopoverGroup>
  );
}
