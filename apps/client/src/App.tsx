import { Route, Routes, Link } from "react-router-dom";
import Home from "./pages/Home";
import Help from "./pages/Help";
import CreateChronicle from "./pages/CreateChronicle";
import ChroniclePage from "./pages/ChroniclePage";
import CombatPage from "./pages/CombatPage";
import CharacterPage from "./pages/CharacterPage";
import StorytellerPage from "./pages/StorytellerPage";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <Link to="/">Vampire Siesta</Link>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chronicles/new" element={<CreateChronicle />} />
          <Route path="/help" element={<Help />} />
          <Route path="/chronicles/:id" element={<ChroniclePage />} />
          <Route path="/chronicles/:id/combat" element={<CombatPage />} />
          <Route path="/c/:uuid" element={<CharacterPage />} />
          <Route path="/c/:uuid/st" element={<StorytellerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

