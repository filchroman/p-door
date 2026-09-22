import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { GameScreen } from './GameScreen';
import { HomeScreen } from './HomeScreen';
import { Toasts } from './Toasts';

export function App() {
  const screen = useAppStore((s) => s.screen);
  return (
    <main className="app-column">
      {screen === 'home' && <HomeScreen />}
      {screen === 'loading' && (
        <div className="loading-screen" role="status">
          {ru.home.loading}
        </div>
      )}
      {screen === 'game' && <GameScreen />}
      <Toasts />
    </main>
  );
}
