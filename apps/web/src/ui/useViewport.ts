import { useEffect, useState } from 'react';

/** Экран телефона по умолчанию: тестовая среда и серверный рендер считают по нему. */
export const DEFAULT_VIEWPORT = 375;

/**
 * Ширина окна для расчёта размеров карт и веера. Обновляется только по `resize` — никакого
 * состояния по таймеру и ни одного обмера на кадр (спека §2a).
 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? DEFAULT_VIEWPORT : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}
