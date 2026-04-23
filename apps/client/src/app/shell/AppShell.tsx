import type { PropsWithChildren } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeaderProvider, useAppHeader } from "../../context/AppHeaderContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

function HeaderIdentity() {
  const { user, logout } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const avatarLetter = user.displayName.trim().slice(0, 1).toUpperCase() || "?";

  async function handleLogout() {
    try {
      await logout();
      navigate("/auth/login", { replace: true });
    } catch (error: any) {
      pushToast(error?.message ?? "Не удалось завершить сеанс", "error");
    }
  }

  return (
    <div className="header-user">
      <Link to="/profile" className="header-user-link">
        <span className={`header-avatar ${user.avatarUrl ? "with-image" : "empty"}`}>
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={`Аватар ${user.displayName}`} />
          ) : (
            <span>{avatarLetter}</span>
          )}
        </span>
        <span className="header-user-name">{user.displayName}</span>
      </Link>
      <button type="button" className="secondary header-logout-button" onClick={handleLogout}>
        Выйти
      </button>
    </div>
  );
}

function AppHeader() {
  const { actions } = useAppHeader();

  return (
    <header className="app-header">
      <div className="brand">
        <Link to="/">Vampire Siesta</Link>
      </div>
      <div className="app-header-right">
        {actions ? <div className="app-header-actions">{actions}</div> : null}
        <HeaderIdentity />
      </div>
    </header>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  return (
    <AppHeaderProvider>
      <div className="app">
        <AppHeader />
        <main className="app-main">{children}</main>
      </div>
    </AppHeaderProvider>
  );
}
