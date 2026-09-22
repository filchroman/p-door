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

export function Segmented<T extends string | number>({ label, value, options, onChange, variant = 'pills' }: SegmentedProps<T>) {
  return (
    <div className={`segmented segmented--${variant}`} role="radiogroup" aria-label={label}>
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
