import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatRole(value: string) {
  switch (value) {
    case "admin":
      return "Администратор";
    case "storyteller":
      return "Рассказчик";
    default:
      return "Игрок";
  }
}

function formatStatus(value: string) {
  return value === "blocked" ? "Заблокирован" : "Активен";
}

function formatProvider(value: string) {
  return value === "yandex" ? "Яндекс" : "Google";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Не удалось прочитать файл"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const { pushToast } = useToast();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName]);

  if (!user) {
    return null;
  }

  const avatarLetter = user.displayName.trim().slice(0, 1).toUpperCase() || "?";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingName(true);
    try {
      await api.patch<{ user: unknown }>("/auth/me", { displayName });
      await refresh();
      pushToast("Имя обновлено", "success");
    } catch (error: any) {
      pushToast(error?.message ?? "Не удалось обновить имя", "error");
    } finally {
      setSavingName(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSavingAvatar(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await api.post<{ user: unknown }>("/auth/me/avatar", { dataUrl });
      await refresh();
      pushToast("Аватар обновлен", "success");
    } catch (error: any) {
      pushToast(error?.message ?? "Не удалось обновить аватар", "error");
    } finally {
      setSavingAvatar(false);
      event.target.value = "";
    }
  }

  return (
    <section className="page profile-page">
      <div className="page-header">
        <div>
          <h1>Профиль</h1>
          <p className="home-subtitle">
            Здесь можно обновить отображаемое имя и текущий аватар.
          </p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="card profile-card">
          <div className="card-header">
            <div className="card-header-main">
              <div className="section-title">Публичное отображение</div>
            </div>
          </div>

          <div className="profile-identity">
            <div className={`profile-avatar ${user.avatarUrl ? "with-image" : "empty"}`}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={`Аватар ${user.displayName}`} />
              ) : (
                <span>{avatarLetter}</span>
              )}
            </div>

            <div className="profile-avatar-actions">
              <label className="profile-upload-button">
                <input
                  type="file"
                  accept="image/*"
                  disabled={savingAvatar}
                  onChange={handleAvatarChange}
                />
                {savingAvatar ? "Загрузка…" : "Заменить аватар"}
              </label>
              <small>Поддерживаются изображения в формате data URL.</small>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Отображаемое имя</span>
              <input
                value={displayName}
                minLength={2}
                maxLength={40}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Email</span>
              <input value={user.email} readOnly />
            </label>

            <button type="submit" className="primary" disabled={savingName}>
              {savingName ? "Сохраняем…" : "Сохранить имя"}
            </button>
          </form>
        </div>

        <div className="card profile-card">
          <div className="card-header">
            <div className="card-header-main">
              <div className="section-title">Статус и привязки</div>
            </div>
          </div>

          <div className="profile-meta-list">
            <div className="profile-meta-row">
              <span>Роль</span>
              <strong>{formatRole(user.role)}</strong>
            </div>
            <div className="profile-meta-row">
              <span>Статус</span>
              <strong>{formatStatus(user.status)}</strong>
            </div>
            <div className="profile-meta-row">
              <span>Последний вход</span>
              <strong>{formatDate(user.lastLoginAt)}</strong>
            </div>
            <div className="profile-meta-row">
              <span>Последняя активность</span>
              <strong>{formatDate(user.lastSeenAt)}</strong>
            </div>
          </div>

          <div className="profile-provider-block">
            <div className="section-title">Подключенные провайдеры</div>
            <div className="profile-provider-list">
              {user.providers.map((provider) => (
                <div key={provider.provider} className="profile-provider-chip">
                  <span>{formatProvider(provider.provider)}</span>
                  <small>Связан {formatDate(provider.linkedAt)}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
