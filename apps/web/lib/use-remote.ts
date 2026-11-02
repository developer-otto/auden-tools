"use client";
import { useEffect, useState } from "react";

export function useRemote<T>(url: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    url: string;
    attempt: number;
    data: T | null;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        const data: T = await response.json();
        if (!controller.signal.aborted)
          setResult({ url, attempt, data, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult((previous) => ({
            url,
            attempt,
            data: previous?.url === url ? previous.data : null,
            error: true,
          }));
      });
    return () => controller.abort();
  }, [url, attempt]);
  return {
    data: result?.url === url ? result.data : null,
    error: result?.url === url && result.error,
    loading: result?.url !== url || result.attempt !== attempt,
    retry: () => setAttempt((value) => value + 1),
  };
}
