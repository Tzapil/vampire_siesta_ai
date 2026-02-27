import { Route, Routes, Link } from "react-router-dom";
import Home from "./pages/Home";
import Help from "./pages/Help";
import ChroniclePage from "./pages/ChroniclePage";
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
          <Route path="/help" element={<Help />} />
          <Route path="/chronicles/:id" element={<ChroniclePage />} />
          <Route path="/c/:uuid" element={<CharacterPage />} />
          <Route path="/c/:uuid/st" element={<StorytellerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

