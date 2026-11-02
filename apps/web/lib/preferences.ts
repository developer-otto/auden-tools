"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const memory = new Map<string, string>();
const eventName = "auden-preferences";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(eventName, callback);
  };
}
function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function usePreference<T>(
  key: string,
  fallback: T,
  validate: (input: unknown) => T,
) {
  const storageKey = `auden:v1:${key}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => null,
  );
  const decode = useCallback(
    (value: string | null): T => {
      try {
        return value === null ? fallback : validate(JSON.parse(value));
      } catch {
        return fallback;
      }
    },
    [fallback, validate],
  );
  const value = useMemo(() => decode(raw), [decode, raw]);
  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const resolved =
        typeof next === "function"
          ? (next as (previous: T) => T)(decode(read(storageKey)))
          : next;
      const json = JSON.stringify(resolved);
      try {
        localStorage.setItem(storageKey, json);
        memory.delete(storageKey);
      } catch {
        memory.set(
          storageKey,
          json,
        ); /* The current session still works without storage. */
      }
      window.dispatchEvent(new Event(eventName));
    },
    [storageKey, decode],
  );
  return [value, setValue] as const;
}
