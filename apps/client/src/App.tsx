import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Help from "./pages/Help";
import CreateChronicle from "./pages/CreateChronicle";
import ChroniclePage from "./pages/ChroniclePage";
import CombatPage from "./pages/CombatPage";
import CharacterPage from "./pages/CharacterPage";
import StorytellerPage from "./pages/StorytellerPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import ProfilePage from "./pages/ProfilePage";
import { AppHeaderProvider, useAppHeader } from "./context/AppHeaderContext";
import { useAuth } from "./context/AuthContext";
import { DictionariesProvider } from "./context/DictionariesContext";
import { useToast } from "./context/ToastContext";
import { buildLoginPath } from "./utils/auth";

function ProtectedRoutes() {
  const { isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div>
          <h2>Проверяем доступ…</h2>
          <p>Пожалуйста, подождите.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={buildLoginPath(`${location.pathname}${location.search}${location.hash}`)}
        replace
      />
    );
  }

  return (
    <DictionariesProvider>
      <Outlet />
    </DictionariesProvider>
  );
}

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

export default function App() {
  return (
    <AppHeaderProvider>
      <div className="app">
        <AppHeader />
        <main className="app-main">
          <Routes>
            <Route path="/auth/login" element={<LoginPage />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Home />} />
              <Route path="/chronicles/new" element={<CreateChronicle />} />
              <Route path="/help" element={<Help />} />
              <Route path="/chronicles/:id" element={<ChroniclePage />} />
              <Route path="/chronicles/:id/combat" element={<CombatPage />} />
              <Route path="/c/:uuid" element={<CharacterPage />} />
              <Route path="/c/:uuid/st" element={<StorytellerPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </main>
      </div>
    </AppHeaderProvider>
  );
}
