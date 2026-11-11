"use client";
import { Card } from "./ui/card";
import { Toggle } from "./ui/toggle";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { type CatalogItem } from "../lib/catalog";
import { matchesQuery } from "../lib/i18n";
import { dateParts } from "../lib/time";
import { getTool, type Tool, type ToolId } from "../lib/tools";
import { useFavorites, useRecent } from "../lib/tool-preferences";
import { Icon } from "./icon";
import { useApp } from "./providers";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

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
    <Toggle
      className={`star-btn ${saved ? "saved" : ""}`}
      pressed={saved}
      aria-label={t(saved ? "取消收藏：{name}" : "收藏：{name}", {
        name: t(getTool(id).name),
      })}
      onPressedChange={() => toggleFavorite(id)}
    >
      <Icon name="star" />
    </Toggle>
  );
}
export function ToolCard({ tool }: { tool: Tool }) {
  const { t } = useApp();
  return (
    <Card as="article" className="tool-card">
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
    </Card>
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
        <Toggle
          className="button"
          aria-label={t(saved ? "已收藏" : "收藏工具")}
          pressed={saved}
          onPressedChange={() => toggleFavorite(id)}
        >
          <Icon name="star" />
          {t(saved ? "已收藏" : "收藏工具")}
        </Toggle>
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
    <Button
      className="icon-btn"
      aria-label={t(label)}
      disabled={disabled}
      onClick={() => copy(value)}
    >
      <Icon name="copy" />
    </Button>
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
  const returnFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const { t } = useApp();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        ref={content}
        className={className}
        {...(!description ? { "aria-describedby": undefined } : {})}
        onOpenAutoFocus={(event) => {
          const active = document.activeElement;
          returnFocus.current = active instanceof HTMLElement ? active : null;
          const search = content.current?.querySelector<HTMLInputElement>(
            'input[type="search"]',
          );
          if (search) {
            event.preventDefault();
            search.focus();
          }
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <div className="modal-heading">
          <div>
            <DialogTitle>{t(title)}</DialogTitle>
            {description ? (
              <DialogDescription className="muted">
                {t(description)}
              </DialogDescription>
            ) : null}
          </div>
          <DialogClose asChild>
            <Button className="icon-btn" aria-label={t("关闭")}>
              <Icon name="close" />
            </Button>
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
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
        <Input
          type="search"
          name="catalog-search"
          aria-label={t("搜索名称、代码或地区")}
          placeholder={t("搜索名称、代码或地区")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="catalog-filters">
        {["all", ...regions].map((item) => (
          <Button
            key={item}
            className={`filter-pill ${item === region ? "active" : ""}`}
            aria-pressed={item === region}
            onClick={() => setRegion(item)}
          >
            {t(item === "all" ? "全部" : item)}
          </Button>
        ))}
      </div>
      <div className="catalog-options">
        {matches.length ? (
          matches.map((item) => {
            const id = item.code || item.id!,
              active = selected.includes(id);
            return (
              <Button
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
              </Button>
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
            <Button className="text-btn" onClick={onSelectAll}>
              {t("选择全部")}
            </Button>
          ) : null}
          <Button className="button primary small" onClick={onClose}>
            {t("完成")}
          </Button>
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
