"use client";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Select, SelectItem } from "./ui/select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isLocale, languageNames, locales, matchesQuery } from "../lib/i18n";
import { categories, getTool, isToolId, tools } from "../lib/tools";
import { useFavorites } from "../lib/tool-preferences";
import { Icon } from "./icon";
import { Modal, ToolIcon } from "./shared";
import { useApp } from "./providers";

function SearchDialog({ onClose }: { onClose: () => void }) {
  const { t } = useApp(),
    [query, setQuery] = useState(""),
    router = useRouter();
  const matches = tools.filter((tool) =>
    matchesQuery(query, tool.name, tool.desc, tool.keywords, tool.id),
  );
  const open = (id: string) => {
    onClose();
    router.push(`/tools/${id}`);
  };
  return (
    <Modal title="快速查找" onClose={onClose}>
      <div className="catalog-search">
        <Icon name="search" />
        <Input
          type="search"
          name="tool-search"
          aria-label={t("搜索全部工具")}
          placeholder={t("搜索工具名称或关键词…")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              matches[0]
            )
              open(matches[0].id);
          }}
        />
      </div>
      <div className="dialog-results">
        {matches.length ? (
          matches.map((tool) => (
            <Button
              key={tool.id}
              className="search-result"
              onClick={() => open(tool.id)}
            >
              <ToolIcon tool={tool} />
              <span>
                <strong>{t(tool.name)}</strong>
                <small>{t(tool.desc)}</small>
              </span>
              <Icon name="right" />
            </Button>
          ))
        ) : (
          <p className="catalog-empty">
            {t("没有找到相关工具，试试其他关键词。")}
          </p>
        )}
      </div>
      <div className="dialog-footer">
        {t("快速到达你需要的工具")}
        <span>{t("↵ 打开 · esc 关闭")}</span>
      </div>
    </Modal>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const { t, locale, setLocale, theme, toggleTheme, notify } = useApp();
  const { favorites } = useFavorites();
  const path = usePathname(),
    params = useSearchParams(),
    router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false);
  const currentId = path.split("/")[2] || "",
    current = isToolId(currentId) ? getTool(currentId) : null;
  const filter = path === "/" ? params.get("filter") || "all" : "";
  const currentName =
    current?.name ||
    (
      { favorites: "我的收藏", recent: "最近使用", ...categories } as Record<
        string,
        string
      >
    )[filter] ||
    "工具首页";
  useEffect(() => {
    document.title = `${t(currentName)} · Auden Tools`;
  }, [t, currentName]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMenuOpen(false);
        setSearchOpen((open) => !open);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "1") {
        event.preventDefault();
        setMenuOpen(false);
        router.push("/");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const closeOnDesktop = () => {
      if (!query.matches) setMenuOpen(false);
    };
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);
  const sidebar = (
    <>
      <Link
        href="/"
        className="brand"
        aria-label={t("Auden Tools 首页")}
        onClick={closeMenu}
      >
        <span className="brand-mark">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>
          auden<span className="brand-light">.tools</span>
          <small>{t("日常工具，触手可及")}</small>
        </span>
      </Link>
      <nav aria-label={t("主导航")}>
        <p className="nav-caption">{t("工作空间")}</p>
        <Link
          href="/"
          className={`nav-item ${filter === "all" ? "active" : ""}`}
          onClick={closeMenu}
        >
          <Icon name="grid" />
          {t("工具首页")}
          <span className="nav-key">⌘ 1</span>
        </Link>
        <Link
          href="/?filter=favorites"
          className={`nav-item ${filter === "favorites" ? "active" : ""}`}
          onClick={closeMenu}
        >
          <Icon name="star" />
          {t("我的收藏")}
          <span className="nav-count">{favorites.length}</span>
        </Link>
        <Link
          href="/?filter=recent"
          className={`nav-item ${filter === "recent" ? "active" : ""}`}
          onClick={closeMenu}
        >
          <Icon name="history" />
          {t("最近使用")}
        </Link>
        <p className="nav-caption category-caption">{t("工具分类")}</p>
        {Object.entries(categories).map(([key, name]) => (
          <Link
            key={key}
            href={`/?filter=${key}`}
            className={`nav-item ${filter === key || current?.category === key ? "active" : ""}`}
            onClick={closeMenu}
          >
            <Icon
              name={
                key === "time"
                  ? "clock"
                  : key === "convert"
                    ? "arrows"
                    : key === "files"
                      ? "files"
                      : "text"
              }
            />
            {t(name)}
            <span className="nav-count">
              {tools.filter((tool) => tool.category === key).length}
            </span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="quiet-note">
          <span className="little-spark">✳</span>
          <p>{t("小工具，大有用处。")}</p>
          <small>{t("把时间留给更重要的事。")}</small>
        </div>
        <Button
          className="quick-search"
          onClick={() => {
            closeMenu();
            setSearchOpen(true);
          }}
        >
          <Icon name="search" />
          {t("快速查找")}
          <kbd>⌘ K</kbd>
        </Button>
        <div className="sidebar-footer">
          <span>
            Auden Tools <b>V1.0</b>
          </span>
          <Button
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={t("切换深浅色")}
          >
            <Icon name={theme === "dark" ? "moon" : "sun"} />
          </Button>
        </div>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("跳转到内容")}
      </a>
      <aside className="sidebar sidebar-desktop">{sidebar}</aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  className="icon-btn mobile-menu"
                  aria-label={t("打开导航")}
                >
                  <Icon name="menu" />
                </Button>
              </SheetTrigger>
              <SheetContent
                className="sidebar sidebar-sheet"
                aria-describedby={undefined}
              >
                <SheetTitle className="sr-only">{t("主导航")}</SheetTitle>
                <SheetClose asChild>
                  <Button
                    className="icon-btn sidebar-sheet-close"
                    aria-label={t("关闭")}
                  >
                    <Icon name="close" />
                  </Button>
                </SheetClose>
                {sidebar}
              </SheetContent>
            </Sheet>
            <span>{t("工作空间")}</span>
            <span className="slash">/</span>
            <strong>{t(currentName)}</strong>
          </div>
          <div className="topbar-actions">
            <div className="language-switch">
              <Icon name="globe" />
              <Select
                name="locale"
                aria-label={t("界面语言")}
                value={locale}
                onValueChange={(value) => {
                  if (isLocale(value)) setLocale(value);
                }}
              >
                {locales.map((value) => (
                  <SelectItem key={value} value={value} lang={value}>
                    {languageNames[value]}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <span className="prototype-label">
              <i />
              {t("即开即用")}
            </span>
            <Button
              className="icon-btn"
              aria-label={t("使用说明")}
              onClick={() =>
                notify(
                  "日常计算在浏览器中完成。汇率显示来源与日期；文件转换需上传到服务器。",
                )
              }
            >
              <Icon name="help" />
            </Button>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="page-footer">
          <span>© 2026 Auden Tools</span>
          <span>
            {t("为每一个日常，省一点时间。")}
            <span className="footer-dot">✳</span>
          </span>
        </footer>
      </div>
      {searchOpen ? (
        <SearchDialog onClose={() => setSearchOpen(false)} />
      ) : null}
    </div>
  );
}
