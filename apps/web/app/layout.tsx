import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppProvider } from "../components/providers";
import { AppShell } from "../components/shell";
import { isLocale, translate } from "../lib/i18n";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const saved = (await cookies()).get("auden-locale")?.value;
  const locale = isLocale(saved) ? saved : "zh-CN";
  return {
    title: {
      default: translate(locale, "Auden Tools — 日常工具，触手可及"),
      template: "%s · Auden Tools",
    },
    description: translate(
      locale,
      "好用的小工具，帮你省下每一个不必浪费的瞬间。",
    ),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const saved = await cookies();
  const rawLocale = saved.get("auden-locale")?.value;
  const locale = isLocale(rawLocale) ? rawLocale : "zh-CN";
  const theme = saved.get("auden-theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${theme === "dark" ? "dark" : ""}`}
      >
        <AppProvider
          initialLocale={locale}
          initialTheme={theme}
          initialNow={Date.now()}
        >
          <Suspense fallback={<div className="page-loading">Auden Tools</div>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </AppProvider>
      </body>
    </html>
  );
}
