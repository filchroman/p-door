import type { CSSProperties } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: string;
}

export interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  /** NoInfer: тип значения выводится из value/options, а не из сеттера useState. */
  onChange(value: NoInfer<T>): void;
  variant?: 'pills' | 'tiles';
}

/**
 * Переключатель. У «пилюль» выделение — один ползунок, который переезжает под выбранный пункт
 * (transform по `--index`, спека §2c.3); у плиток выбранная слегка «выпрыгивает».
 */
export function Segmented<T extends string | number>({ label, value, options, onChange, variant = 'pills' }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const style = { '--index': index, '--count': options.length } as CSSProperties;
  return (
    <div className={`segmented segmented--${variant}`} role="radiogroup" aria-label={label} style={style}>
      {variant === 'pills' && <span className="segmented__thumb" aria-hidden="true" />}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            className={`segmented__item${active ? ' is-active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.icon && (
              <span className="segmented__icon" aria-hidden="true">
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
