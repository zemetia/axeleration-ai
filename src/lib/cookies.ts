/**
 * Client-side cookie utilities.
 * For server-side access in Server Components or Server Actions,
 * use `cookies()` from `next/headers` instead.
 */

export interface CookieOptions {
  /** Cookie path. Defaults to '/' */
  path?: string;
  /** Cookie domain */
  domain?: string;
  /** Max age in seconds. Use -1 to delete. */
  maxAge?: number;
  /** Explicit expiry date */
  expires?: Date;
  /** HTTPS only. Auto-enabled in production. */
  secure?: boolean;
  /** SameSite policy. Defaults to 'Lax' */
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;

  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${encodeURIComponent(name)}=`));

  if (!match) return undefined;

  const raw = match.split('=').slice(1).join('=');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') return;

  const {
    path = '/',
    domain,
    maxAge,
    expires,
    secure = process.env['NODE_ENV'] === 'production',
    sameSite = 'Lax',
  } = options;

  const parts: string[] = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `path=${path}`,
    `SameSite=${sameSite}`,
  ];

  if (domain) parts.push(`Domain=${domain}`);
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  if (secure) parts.push('Secure');

  document.cookie = parts.join('; ');
}

export function deleteCookie(
  name: string,
  options: Pick<CookieOptions, 'path' | 'domain'> = {},
): void {
  setCookie(name, '', { ...options, maxAge: -1 });
}

export function getAllCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};

  return Object.fromEntries(
    document.cookie
      .split('; ')
      .filter(Boolean)
      .map((row) => {
        const eqIdx = row.indexOf('=');
        const key = row.slice(0, eqIdx);
        const val = row.slice(eqIdx + 1);
        try {
          return [decodeURIComponent(key), decodeURIComponent(val)];
        } catch {
          return [key, val];
        }
      }),
  );
}

/** Parse a raw cookie header string (e.g. from `request.headers.get('cookie')`) */
export function parseCookieHeader(header: string): Record<string, string> {
  return Object.fromEntries(
    header
      .split('; ')
      .filter(Boolean)
      .map((row) => {
        const eqIdx = row.indexOf('=');
        const key = row.slice(0, eqIdx);
        const val = row.slice(eqIdx + 1);
        try {
          return [decodeURIComponent(key), decodeURIComponent(val)];
        } catch {
          return [key, val];
        }
      }),
  );
}
