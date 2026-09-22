import type { ReactNode } from 'react';

export function FlipIn({ children }: { flip: boolean; children: ReactNode }) {
  return <>{children}</>;
}
