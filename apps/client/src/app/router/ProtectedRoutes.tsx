import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { DictionariesProvider } from "../../context/DictionariesContext";
import { buildLoginPath } from "../../utils/auth";

export function ProtectedRoutes() {
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
