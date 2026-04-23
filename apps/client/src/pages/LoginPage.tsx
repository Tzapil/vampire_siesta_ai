import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { AuthProviderOptionDto } from "../api/types";
import { useAuth } from "../context/AuthContext";
import { getAuthErrorText, sanitizeNextPath } from "../utils/auth";

export default function LoginPage() {
  const { isLoading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [providers, setProviders] = useState<AuthProviderOptionDto[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState<string | null>(null);

  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const authErrorText = getAuthErrorText(searchParams.get("error"));

  useEffect(() => {
    let active = true;

    async function loadProviders() {
      try {
        const data = await api.get<{ providers: AuthProviderOptionDto[] }>("/auth/providers");
        if (!active) return;
        setProviders(data.providers);
      } catch (error: any) {
        if (!active) return;
        setProvidersError(error?.message ?? "Не удалось загрузить провайдеры входа");
      } finally {
        if (active) {
          setProvidersLoading(false);
        }
      }
    }

    void loadProviders();

    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div>
          <h2>Проверяем сессию…</h2>
          <p>Пожалуйста, подождите.</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={nextPath} replace />;
  }

  return (
    <section className="page auth-page">
      <div className="auth-shell">
        <div className="auth-hero">
          <div className="auth-kicker">Vampire Siesta</div>
          <h1>Вход в приложение</h1>
          <p>
            Для доступа к хроникам, персонажам и Socket-событиям нужна авторизация
            через OAuth.
          </p>
        </div>

        <div className="card auth-card">
          <div className="card-header">
            <div className="card-header-main">
              <div className="section-title">Выберите провайдера</div>
              <span className="home-subtitle">
                После успешного входа вы вернетесь туда, где остановились.
              </span>
            </div>
          </div>

          {authErrorText ? <div className="auth-alert error">{authErrorText}</div> : null}
          {nextPath !== "/" ? (
            <div className="auth-alert">
              После входа откроется: <code>{nextPath}</code>
            </div>
          ) : null}

          {providersLoading ? <p>Загрузка провайдеров…</p> : null}

          {!providersLoading && providersError ? (
            <div className="auth-alert error">
              <p>{providersError}</p>
              <button type="button" className="secondary" onClick={() => window.location.reload()}>
                Повторить
              </button>
            </div>
          ) : null}

          {!providersLoading && !providersError ? (
            <div className="auth-provider-list">
              {providers.map((provider) => {
                const href =
                  nextPath === "/"
                    ? provider.startPath
                    : `${provider.startPath}?next=${encodeURIComponent(nextPath)}`;

                return (
                  <a
                    key={provider.id}
                    href={href}
                    className={`auth-provider-button ${provider.id}`}
                  >
                    Войти через {provider.label}
                  </a>
                );
              })}

              {providers.length === 0 ? (
                <div className="auth-alert error">
                  На сервере не настроен ни один OAuth-провайдер.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
