import { useEffect } from 'react';
import { ru } from '../i18n/ru';
import { useAppStore } from '../store/appStore';
import { DebugPanel } from './debug/DebugPanel';
import { GameScreen } from './GameScreen';
import { HomeScreen } from './HomeScreen';
import { LobbyScreen } from './LobbyScreen';
import { Toasts } from './Toasts';

/** Панель отладки — только в dev-сборке или по `?debug`, и только там, где есть чем управлять (тренировка). */
function useDebugAllowed(): boolean {
  const hasDebugSeam = useAppStore((s) => !!s.client?.debug);
  const wanted = import.meta.env.DEV || (typeof location !== 'undefined' && location.search.includes('debug'));
  return hasDebugSeam && wanted;
}

export function App() {
  const screen = useAppStore((s) => s.screen);
  const debugAllowed = useDebugAllowed();
  // На столе страница не прокручивается: палец тянет карту, а не экран (и не «резинку» iOS).
  useEffect(() => {
    document.body.classList.toggle('is-game', screen === 'game');
    return () => document.body.classList.remove('is-game');
  }, [screen]);
  return (
    <main className="app-column">
      {screen === 'home' && <HomeScreen />}
      {screen === 'loading' && (
        <div className="loading-screen" role="status">
          {ru.home.loading}
        </div>
      )}
      {screen === 'lobby' && <LobbyScreen />}
      {screen === 'game' && <GameScreen />}
      <Toasts />
      {screen === 'game' && debugAllowed && <DebugPanel />}
    </main>
  );
}
