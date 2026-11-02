"use client";
import Link from "next/link";
import { useApp } from "../components/providers";
export default function NotFound() {
  const { t } = useApp();
  return (
    <section className="empty-state">
      <h1>404</h1>
      <p>{t("页面不存在。")}</p>
      <Link className="button primary" href="/">
        {t("工具首页")}
      </Link>
    </section>
  );
}
