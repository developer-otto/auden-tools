"use client";
import { useCallback } from "react";
import { usePreference } from "./preferences";
import { isToolId, type ToolId } from "./tools";

const defaultFavorites: ToolId[] = ["timestamp", "world", "currency"];
const emptyRecent: ToolId[] = [];
const validTools = (value: unknown): ToolId[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is ToolId => typeof id === "string" && isToolId(id),
          ),
        ),
      ]
    : defaultFavorites;
const validRecent = (value: unknown) =>
  Array.isArray(value) ? validTools(value).slice(0, 20) : emptyRecent;

// Subscribe in the component that renders the preference, so every streamed
// boundary hydrates with its own server snapshot before reading localStorage.
export function useFavorites() {
  const [favorites, setFavorites] = usePreference(
    "favorites",
    defaultFavorites,
    validTools,
  );
  const toggleFavorite = useCallback(
    (id: ToolId) =>
      setFavorites((previous) =>
        previous.includes(id)
          ? previous.filter((item) => item !== id)
          : [...previous, id],
      ),
    [setFavorites],
  );
  return { favorites, toggleFavorite };
}

export function useRecent() {
  const [recent, setRecent] = usePreference("recent", emptyRecent, validRecent);
  const visit = useCallback(
    (id: ToolId) =>
      setRecent((previous) =>
        [id, ...previous.filter((item) => item !== id)].slice(0, 20),
      ),
    [setRecent],
  );
  return { recent, visit };
}
