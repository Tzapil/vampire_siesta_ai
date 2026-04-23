import { Route, Routes } from "react-router-dom";
import CharacterPage from "../../pages/CharacterPage";
import ChroniclePage from "../../pages/ChroniclePage";
import CombatPage from "../../pages/CombatPage";
import CreateChronicle from "../../pages/CreateChronicle";
import Help from "../../pages/Help";
import Home from "../../pages/Home";
import LoginPage from "../../pages/LoginPage";
import NotFound from "../../pages/NotFound";
import ProfilePage from "../../pages/ProfilePage";
import StorytellerPage from "../../pages/StorytellerPage";
import { ProtectedRoutes } from "./ProtectedRoutes";

export function AppRouter() {
  return (
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
  );
}
