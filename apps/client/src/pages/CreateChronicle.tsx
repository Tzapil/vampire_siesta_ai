import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ChronicleDto } from "../api/types";
import { useToast } from "../context/ToastContext";

export default function CreateChronicle() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      pushToast("Введите название хроники", "error");
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<ChronicleDto>("/chronicles", {
        name: trimmedName,
        description: description.trim()
      });
      pushToast("Хроника создана", "success");
      navigate(`/chronicles/${created._id}`);
    } catch (err: any) {
      pushToast(err?.message ?? "Не удалось создать хронику", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <h1>Создать хронику</h1>
        <button type="button" className="icon-button" title="Назад" onClick={() => navigate(-1)}>
          ←
        </button>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="chronicle-name">Название</label>
          <input
            id="chronicle-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Камарилья Невы"
          />
        </div>
        <div className="field">
          <label htmlFor="chronicle-description">Описание</label>
          <textarea
            id="chronicle-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="О чем хроника, ключевые персонажи, тон..."
            rows={6}
          />
        </div>
        <div className="page-actions">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Создание..." : "Создать"}
          </button>
          <button type="button" className="secondary" onClick={() => navigate(-1)}>
            Отмена
          </button>
        </div>
      </form>
    </section>
  );
}
