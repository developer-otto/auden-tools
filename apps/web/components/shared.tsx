"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { type CatalogItem } from "../lib/catalog";
import { matchesQuery } from "../lib/i18n";
import { dateParts } from "../lib/time";
import { getTool, type Tool, type ToolId } from "../lib/tools";
import { useFavorites, useRecent } from "../lib/tool-preferences";
import { Icon } from "./icon";
import { useApp } from "./providers";

export function Flag({
  item,
  small = false,
}: {
  item: Pick<CatalogItem, "flag" | "country">;
  small?: boolean;
}) {
  const { t } = useApp();
  return (
    <span
      className={`region-flag ${small ? "small" : ""}`}
      role="img"
      aria-label={t(item.country)}
    >
      {item.flag}
    </span>
  );
}
export function ToolIcon({ tool }: { tool: Tool }) {
  return (
    <span className={`tool-icon ${tool.color}`}>
      <Icon name={tool.icon} />
    </span>
  );
}
export function StarButton({ id }: { id: ToolId }) {
  const { t } = useApp(),
    { favorites, toggleFavorite } = useFavorites(),
    saved = favorites.includes(id);
  return (
    <button
      className={`star-btn ${saved ? "saved" : ""}`}
      aria-pressed={saved}
      aria-label={t(saved ? "取消收藏：{name}" : "收藏：{name}", {
        name: t(getTool(id).name),
      })}
      onClick={() => toggleFavorite(id)}
    >
      <Icon name="star" />
    </button>
  );
}
export function ToolCard({ tool }: { tool: Tool }) {
  const { t } = useApp();
  return (
    <article className="tool-card">
      <Link
        href={`/tools/${tool.id}`}
        className="card-link"
        aria-label={t("打开{name}", { name: t(tool.name) })}
      />
      <ToolIcon tool={tool} />
      <div className="card-body">
        <h3>{t(tool.name)}</h3>
        <p>{t(tool.desc)}</p>
        <span className="tool-category">{tool.label}</span>
      </div>
      <StarButton id={tool.id} />
    </article>
  );
}
export function DetailHeader({
  id,
  description,
  children,
}: {
  id: ToolId;
  description: string;
  children?: ReactNode;
}) {
  const { t } = useApp(),
    { favorites, toggleFavorite } = useFavorites(),
    { visit } = useRecent(),
    tool = getTool(id),
    saved = favorites.includes(id);
  useEffect(() => {
    visit(id);
  }, [id, visit]);
  return (
    <div className="detail-head">
      <div>
        <Link className="back-link" href="/">
          <Icon name="left" />
          {t("全部工具")}
        </Link>
        <div className="detail-heading-line">
          <ToolIcon tool={tool} />
          <h1>{t(tool.name)}</h1>
        </div>
        <p className="detail-description">{t(description)}</p>
      </div>
      <div className="detail-actions">
        <button
          className="button"
          aria-label={t(saved ? "已收藏" : "收藏工具")}
          aria-pressed={saved}
          onClick={() => toggleFavorite(id)}
        >
          <Icon name="star" />
          {t(saved ? "已收藏" : "收藏工具")}
        </button>
        {children}
      </div>
    </div>
  );
}
export function CopyButton({
  value,
  label = "复制",
  disabled = false,
}: {
  value: string;
  label?: string;
  disabled?: boolean;
}) {
  const { t, copy } = useApp();
  return (
    <button
      className="icon-btn"
      aria-label={t(label)}
      disabled={disabled}
      onClick={() => copy(value)}
    >
      <Icon name="copy" />
    </button>
  );
}
export function AnalogClock({
  date,
  zone,
  large = false,
}: {
  date: Date;
  zone: string;
  large?: boolean;
}) {
  const p = dateParts(date, zone),
    hours = Number(p.hour),
    minutes = Number(p.minute);
  return (
    <div className={`analog-clock ${large ? "large" : ""}`} aria-hidden="true">
      {[0, 90, 180, 270].map((deg) => (
        <i
          key={deg}
          className="clock-tick"
          style={{ transform: `rotate(${deg}deg)` }}
        />
      ))}
      <i
        className="clock-hand clock-hour"
        style={{ transform: `rotate(${hours * 30 + minutes / 2}deg)` }}
      />
      <i
        className="clock-hand clock-minute"
        style={{ transform: `rotate(${minutes * 6}deg)` }}
      />
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  className = "catalog-dialog",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    { t } = useApp();
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    node.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={className}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id={titleId}>{t(title)}</h2>
          {description ? <p className="muted">{t(description)}</p> : null}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={t("关闭")}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
type PickerItem = CatalogItem & {
  code?: string;
  id?: string;
  tz?: string;
  sign?: string;
};
export function CatalogPicker<T extends PickerItem>({
  title,
  description,
  items,
  selected,
  onSelect,
  onClose,
  onSelectAll,
  disabled,
  meta,
  footer,
  multiple = true,
}: {
  title: string;
  description: string;
  items: T[];
  selected: string[];
  onSelect: (item: T) => void;
  onClose: () => void;
  onSelectAll?: () => void;
  disabled?: (item: T) => boolean;
  meta?: (item: T) => string;
  footer?: string;
  multiple?: boolean;
}) {
  const { t } = useApp(),
    [query, setQuery] = useState(""),
    [region, setRegion] = useState("all");
  const regions = [...new Set(items.map((item) => item.region))];
  const matches = items.filter(
    (item) =>
      (region === "all" || region === item.region) &&
      matchesQuery(
        query,
        item.name,
        item.country,
        item.code,
        item.id,
        item.tz,
        item.keywords,
      ),
  );
  return (
    <Modal title={title} description={description} onClose={onClose}>
      <div className="catalog-search">
        <Icon name="search" />
        <input
          type="search"
          name="catalog-search"
          autoFocus
          aria-label={t("搜索名称、代码或地区")}
          placeholder={t("搜索名称、代码或地区")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="catalog-filters">
        {["all", ...regions].map((item) => (
          <button
            key={item}
            className={`filter-pill ${item === region ? "active" : ""}`}
            aria-pressed={item === region}
            onClick={() => setRegion(item)}
          >
            {t(item === "all" ? "全部" : item)}
          </button>
        ))}
      </div>
      <div className="catalog-options">
        {matches.length ? (
          matches.map((item) => {
            const id = item.code || item.id!,
              active = selected.includes(id);
            return (
              <button
                key={id}
                className={`catalog-option ${active ? "selected" : ""}`}
                aria-pressed={active}
                disabled={disabled?.(item)}
                onClick={() => onSelect(item)}
              >
                <Flag item={item} />
                <span className="catalog-option-label">
                  <strong>
                    {item.code || t(item.name)}
                    <em>{t(item.code ? item.name : item.country)}</em>
                  </strong>
                  <small>{item.tz || t(item.country)}</small>
                </span>
                <span className="catalog-option-end">
                  {meta ? <small>{meta(item)}</small> : null}
                  <span
                    className={`catalog-checkbox ${multiple ? "" : "radio"}`}
                  >
                    {active ? <Icon name="check" /> : null}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="catalog-empty">
            {t("没有匹配结果，请尝试其他关键词。")}
          </p>
        )}
      </div>
      <div className="catalog-footer">
        <span aria-live="polite">{footer}</span>
        <div>
          {onSelectAll ? (
            <button className="text-btn" onClick={onSelectAll}>
              {t("选择全部")}
            </button>
          ) : null}
          <button className="button primary small" onClick={onClose}>
            {t("完成")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
export function Notice({
  children,
  icon = "shield",
}: {
  children: ReactNode;
  icon?: string;
}) {
  return (
    <div className="notice">
      <Icon name={icon} />
      <span>{children}</span>
    </div>
  );
}
export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p className="validation-error" role="alert">
      {children}
    </p>
  );
}
