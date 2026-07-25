import type { PersistStorage, StorageValue } from 'zustand/middleware';

import { deleteCookie, getCookie, setCookie, type CookieOptions } from '@/lib/cookies';

export interface CookieStorageOptions extends CookieOptions {
  /** Prefix for all cookie keys to avoid collisions. Defaults to 'zst' */
  prefix?: string;
}

/**
 * Zustand `persist` storage adapter backed by browser cookies.
 *
 * Use this when persisted state needs to be readable on the server
 * (e.g. theme preference to prevent flash-of-wrong-theme).
 *
 * @example
 * ```ts
 * persist(
 *   (set) => ({ ... }),
 *   {
 *     name: 'preferences',
 *     storage: createCookieStorage({ maxAge: 60 * 60 * 24 * 365 }),
 *   }
 * )
 * ```
 */
export function createCookieStorage<T>(
  options: CookieStorageOptions = {},
): PersistStorage<T> {
  const { prefix = 'zst', ...cookieOptions } = options;

  const resolved: CookieOptions = {
    path: '/',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365,
    ...cookieOptions,
  };

  const key = (name: string) => `${prefix}_${name}`;

  return {
    getItem: (name): StorageValue<T> | null => {
      const raw = getCookie(key(name));
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw) as StorageValue<T>;
      } catch {
        return null;
      }
    },

    setItem: (name, value): void => {
      setCookie(key(name), JSON.stringify(value), resolved);
    },

    removeItem: (name): void => {
      deleteCookie(key(name), { path: resolved.path, domain: resolved.domain });
    },
  };
}
