import type { CSSProperties, ReactNode } from 'react';

export interface AnimatedCardProps {
  /** Ключ карты (cardKey) — в Task 13 станет layoutId для перелёта между зонами. */
  id: string;
  className?: string;
  style?: CSSProperties;
  /** Улетать ли при исчезновении (отбой). */
  exit?: boolean;
  /** Карта не летает сама — её несёт контейнер (большой веер руки). */
  still?: boolean;
  children: ReactNode;
}

export function AnimatedCard({ className, style, children }: AnimatedCardProps) {
  return (
    <div className={`animated-card ${className ?? ''}`.trim()} style={style}>
      {children}
    </div>
  );
}
