export function formatDate(
  date: Date | string | number,
  locale = 'en',
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

export function truncate(str: string, maxLength: number, suffix = '…'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length).trimEnd() + suffix;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isServer(): boolean {
  return typeof window === 'undefined';
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
