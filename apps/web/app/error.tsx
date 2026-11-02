"use client";
import { useApp } from "../components/providers";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useApp();
  return (
    <section className="empty-state">
      <h1>{t("页面加载失败。")}</h1>
      <p>{t("请重试，或返回工具首页。")}</p>
      <button className="button primary" onClick={reset}>
        {t("重试")}
      </button>
    </section>
  );
}
