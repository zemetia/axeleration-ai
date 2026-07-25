'use client';

import { useCallback, useEffect, useState } from 'react';

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Silently handle write failures (e.g., storage quota exceeded)
    }
  }, [key, storedValue]);

  const setValue: SetValue<T> = useCallback(
    (value) => {
      setStoredValue((prev) => (typeof value === 'function' ? (value as (p: T) => T)(prev) : value));
    },
    [],
  );

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch {
      // Silently handle removal failures
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
