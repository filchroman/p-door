/** Аватар: фото из Telegram (URL) или эмодзи-заглушка. Всегда `aria-hidden` — имя стоит рядом текстом. */
export function Avatar({ value, className = 'avatar' }: { value: string; className?: string }) {
  if (/^https?:\/\//.test(value)) {
    return (
      <span className={`${className} avatar--photo`} aria-hidden="true">
        <img src={value} alt="" decoding="async" referrerPolicy="no-referrer" />
      </span>
    );
  }
  return (
    <span className={className} aria-hidden="true">
      {value}
    </span>
  );
}
