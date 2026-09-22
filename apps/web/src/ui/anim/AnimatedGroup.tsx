import type { HTMLAttributes, ReactNode } from 'react';

export interface AnimatedGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** true — контейнер двигается одной трансформацией (Task 13). */
  animate: boolean;
  children: ReactNode;
}

export function AnimatedGroup({ animate: _animate, children, ...rest }: AnimatedGroupProps) {
  return <div {...rest}>{children}</div>;
}
