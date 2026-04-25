import GameBoard from '../components/GameBoard';
import ThemeToggle from '../components/ThemeToggle';
import { GameProvider } from '../context/GameContext';

export default function Home() {
  return (
    <GameProvider>
      <main className="main-container">
        <div className="game-wrapper">
          <ThemeToggle />
          <header className="game-header">
            <h2>Open Ludo</h2>
          </header>
          <GameBoard />
        </div>
      </main>
    </GameProvider>
  );
}
