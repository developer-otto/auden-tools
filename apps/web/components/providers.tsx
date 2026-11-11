"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { translate, type Locale, type Translate } from "../lib/i18n";
import { clockSnapshot, subscribeClock } from "../lib/clock";
import { Toast, ToastProvider, ToastViewport } from "./ui/toast";
type AppContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  theme: "light" | "dark";
  toggleTheme: () => void;
  notify: (key: string) => void;
  copy: (text: string) => Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);
const ClockContext = createContext(0);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider is missing");
  return value;
}
export function useNow() {
  const initialNow = useContext(ClockContext);
  return useSyncExternalStore(
    subscribeClock,
    () => clockSnapshot() ?? initialNow,
    () => initialNow,
  );
}
export function AppProvider({
  initialLocale,
  initialTheme,
  initialNow,
  children,
}: {
  initialLocale: Locale;
  initialTheme: "light" | "dark";
  initialNow: number;
  children: ReactNode;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const [theme, updateTheme] = useState(initialTheme);
  const [toast, setToast] = useState({ id: 0, message: "" });
  const t = useCallback<Translate>(
    (key, values) => translate(locale, key, values),
    [locale],
  );
  const notify = useCallback((message: string) => {
    setToast(({ id }) => ({ id: id + 1, message }));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.body.classList.toggle("dark", theme === "dark");
  }, [locale, theme]);
  const setLocale = useCallback((value: Locale) => {
    updateLocale(value);
    document.cookie = `auden-locale=${value}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);
  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    updateTheme(next);
    document.cookie = `auden-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }, [theme]);
  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        notify("已复制到剪贴板");
      } catch {
        notify("复制失败，请选中文字手动复制。");
      }
    },
    [notify],
  );
  const context = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      theme,
      toggleTheme,
      notify,
      copy,
    }),
    [locale, setLocale, t, theme, toggleTheme, notify, copy],
  );
  return (
    <AppContext value={context}>
      <ToastProvider duration={2800} label={t("通知")}>
        <ClockContext value={initialNow}>{children}</ClockContext>
        {toast.message ? (
          <Toast
            key={toast.id}
            onClose={() =>
              setToast((current) =>
                current.id === toast.id ? { ...current, message: "" } : current,
              )
            }
          >
            {t(toast.message)}
          </Toast>
        ) : null}
        <ToastViewport className="toast-viewport" label={t("通知")} />
      </ToastProvider>
    </AppContext>
  );
}
