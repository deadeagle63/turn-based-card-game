import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainMenu from "./pages/MainMenu.tsx";
import PlayGame from "./pages/PlayGame.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/play" element={<PlayGame />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
