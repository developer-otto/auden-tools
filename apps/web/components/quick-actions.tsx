"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { usePreference } from "../lib/preferences";
import { useFavorites } from "../lib/tool-preferences";
import type { ToolId } from "../lib/tools";
import { Icon } from "./icon";
import { useApp } from "./providers";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type Point = { x: number; y: number };
type Bounds = { width: number; height: number };
type Geometry = { point: Point; bounds: Bounds };
type MenuMode = "list" | "fan";
type Action = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: string;
  href?: string;
  pressed?: boolean;
  run: () => void;
};
type Placement = {
  side: "top" | "bottom" | "left" | "right";
  align: "start" | "center" | "end";
};
const size = 48;
const margin = 12;
const threshold = 5;
const validateMode = (value: unknown): MenuMode =>
  value === "fan" ? "fan" : "list";
const defaultPlacement: Placement = { side: "top", align: "end" };
const arrows: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function viewport(): Bounds {
  const root = document.documentElement;
  return { width: root.clientWidth, height: root.clientHeight };
}

function clamp(point: Point, { width, height }: Bounds): Point {
  const limit = (value: number, length: number) =>
    Math.max(margin, Math.min(value, length - size - margin));
  return { x: limit(point.x, width), y: limit(point.y, height) };
}

function preferredPlacement(
  point: Point,
  { width, height }: Bounds,
): Placement {
  const x = point.x + size / 2;
  const y = point.y + size / 2;
  const column =
    x < width / 3 ? "left" : x > (width * 2) / 3 ? "right" : "center";
  const row =
    y < height / 3 ? "top" : y > (height * 2) / 3 ? "bottom" : "middle";
  if (row === "middle" && column !== "center")
    return { side: column === "left" ? "right" : "left", align: "center" };
  return {
    side: row === "bottom" ? "top" : "bottom",
    align: column === "left" ? "start" : column === "right" ? "end" : "center",
  };
}

function fanPositions(
  { point, bounds }: Geometry,
  count: number,
): Point[] | null {
  const center = { x: point.x + size / 2, y: point.y + size / 2 };
  const column =
    center.x < bounds.width / 3
      ? 1
      : center.x > (bounds.width * 2) / 3
        ? -1
        : 0;
  const row =
    center.y < bounds.height / 3
      ? 1
      : center.y > (bounds.height * 2) / 3
        ? -1
        : 0;
  const angle = (Math.atan2(row, column) * 180) / Math.PI;
  const preferredSweep = column && row ? 86 : column || row ? 136 : 360;
  const radii = [
    [100, 100],
    [122, 122],
    [100, 155],
    [120, 176],
    [130, 186],
  ] as const;
  const clearance = size + 4;

  for (const sweep of [preferredSweep, 100, 124, 150, 180, 360]) {
    for (const rotation of [0, 12, -12, 24, -24]) {
      for (const [inner, outer] of radii) {
        const offsets = Array.from({ length: count }, (_, index) => {
          const fraction =
            index / (sweep === 360 ? count : Math.max(1, count - 1));
          const radians =
            ((angle + rotation + sweep * (fraction - 0.5)) * Math.PI) / 180;
          const radius = index % 2 ? outer : inner;
          return {
            x: Math.cos(radians) * radius,
            y: Math.sin(radians) * radius,
          };
        });
        if (
          offsets.every(({ x, y }, index) => {
            const cx = center.x + x;
            const cy = center.y + y;
            const pad = size / 2 + 4;
            return (
              cx >= pad &&
              cy >= pad &&
              cx <= bounds.width - pad &&
              cy <= bounds.height - pad &&
              offsets
                .slice(0, index)
                .every(
                  (other) => Math.hypot(x - other.x, y - other.y) >= clearance,
                )
            );
          })
        )
          return offsets;
      }
    }
  }
  return null;
}

function coordinates(element: HTMLElement): Point {
  const { left, top } = element.getBoundingClientRect();
  return { x: left, y: top };
}

export function QuickActions({
  pathname,
  toolId,
  contactEmail,
  onSearch,
}: {
  pathname: string;
  toolId?: ToolId;
  contactEmail: string;
  onSearch: () => void;
}) {
  const { t, copy, theme, toggleTheme } = useApp();
  const { favorites, toggleFavorite } = useFavorites();
  const hintId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const drag = useRef<{
    id: number;
    origin: Point;
    pointer: Point;
    moved: boolean;
  } | null>(null);
  const ignoreClick = useRef(false);
  const handingOffFocus = useRef(false);
  const [position, setPosition] = useState<Point | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [mode, setMode] = usePreference<MenuMode>(
    "quick-actions-mode",
    "list",
    validateMode,
  );
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const bounds = viewport();
      setPosition((previous) => (previous ? clamp(previous, bounds) : null));
      if (trigger.current)
        setGeometry({
          point: clamp(coordinates(trigger.current), bounds),
          bounds,
        });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    ignoreClick.current = false;
    drag.current = {
      id: event.pointerId,
      origin: coordinates(event.currentTarget),
      pointer: { x: event.clientX, y: event.clientY },
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.pointer.x;
    const dy = event.clientY - current.pointer.y;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < threshold) return;
      current.moved = true;
      setDragging(true);
      setOpen(false);
    }
    setPosition(
      clamp({ x: current.origin.x + dx, y: current.origin.y + dy }, viewport()),
    );
  }

  function finishPointer(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.id !== event.pointerId) return;
    ignoreClick.current = drag.current.moved || event.type === "pointercancel";
    drag.current = null;
    setDragging(false);
  }

  const saved = toolId ? favorites.includes(toolId) : false;
  const close = () => setOpen(false);
  const actions: Action[] = [
    {
      id: "search",
      label: t("快速查找"),
      shortLabel: t("搜索"),
      icon: "search",
      run: () => {
        handingOffFocus.current = true;
        trigger.current?.focus({ preventScroll: true });
        close();
        onSearch();
      },
    },
    ...(toolId
      ? [
          {
            id: "favorite",
            label: t(saved ? "取消收藏工具" : "收藏工具"),
            shortLabel: t(saved ? "取消收藏" : "收藏"),
            icon: "star",
            pressed: saved,
            run: () => {
              toggleFavorite(toolId);
              close();
            },
          },
        ]
      : []),
    {
      id: "favorites",
      label: t("我的收藏"),
      icon: "grid",
      href: "/?filter=favorites",
      run: close,
    },
    {
      id: "share",
      label: t("复制页面链接"),
      shortLabel: t("分享"),
      icon: "copy",
      run: () => {
        void copy(new URL(pathname, window.location.origin).href);
        close();
      },
    },
    {
      id: "theme",
      label: t("切换深浅色"),
      shortLabel: t("主题"),
      icon: theme === "dark" ? "sun" : "moon",
      run: () => {
        toggleTheme();
        close();
      },
    },
    {
      id: "contact",
      label: t("联系邮箱"),
      icon: "mail",
      href: `mailto:${contactEmail}`,
      run: close,
    },
    ...(position
      ? [
          {
            id: "reset",
            label: t("重置悬浮按钮位置"),
            shortLabel: t("重置"),
            icon: "right",
            run: () => {
              setPosition(null);
              close();
            },
          },
        ]
      : []),
    {
      id: "mode",
      label: t(mode === "list" ? "切换为扇形菜单" : "切换为列表菜单"),
      shortLabel: t(mode === "list" ? "扇形" : "列表"),
      icon: "menu",
      run: () => setMode(mode === "list" ? "fan" : "list"),
    },
  ];
  const offsets =
    open && mode === "fan" && geometry
      ? fanPositions(geometry, actions.length)
      : null;
  const placement = geometry
    ? preferredPlacement(geometry.point, geometry.bounds)
    : defaultPlacement;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next && trigger.current)
          setGeometry({
            point: coordinates(trigger.current),
            bounds: viewport(),
          });
        setOpen(next);
      }}
    >
      <span className="sr-only" id={hintId}>
        {t("可拖动；也可用方向键移动。")}
      </span>
      <PopoverTrigger asChild>
        <Button
          ref={trigger}
          className="quick-actions-trigger"
          aria-label={t(open ? "关闭快捷操作" : "打开快捷操作")}
          aria-describedby={hintId}
          data-dragging={dragging || undefined}
          style={
            position
              ? {
                  left: position.x,
                  top: position.y,
                  right: "auto",
                  bottom: "auto",
                }
              : undefined
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onLostPointerCapture={finishPointer}
          onClick={(event) => {
            if (event.detail > 0 && ignoreClick.current) event.preventDefault();
            ignoreClick.current = false;
          }}
          onKeyDown={(event) => {
            const direction = arrows[event.key];
            if (
              open ||
              !direction ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey
            )
              return;
            event.preventDefault();
            const point = coordinates(event.currentTarget);
            const step = event.shiftKey ? 48 : 16;
            setPosition(
              clamp(
                {
                  x: point.x + direction.x * step,
                  y: point.y + direction.y * step,
                },
                viewport(),
              ),
            );
          }}
        >
          <Icon name={open ? "close" : "more"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        {...(offsets
          ? ({
              side: "bottom",
              align: "center",
              avoidCollisions: false,
            } as const)
          : placement)}
        className="ui-popover quick-actions-popover"
        sideOffset={offsets ? -size : 10}
        data-layout={offsets ? "fan" : "list"}
        aria-label={t("快捷操作")}
        onCloseAutoFocus={(event) => {
          if (handingOffFocus.current) {
            event.preventDefault();
            handingOffFocus.current = false;
          }
        }}
        onKeyDown={(event) => {
          if (!offsets || !arrows[event.key]) return;
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              ".quick-action",
            ),
          ];
          const index = buttons.indexOf(document.activeElement as HTMLElement);
          if (index < 0) return;
          event.preventDefault();
          const delta =
            event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
          buttons[(index + delta + buttons.length) % buttons.length]?.focus({
            preventScroll: true,
          });
        }}
      >
        {!offsets ? (
          <p className="quick-actions-title">
            {t("快捷操作")}
            {mode === "fan" ? <small>{t("空间不足时使用列表。")}</small> : null}
          </p>
        ) : null}
        {actions.map(
          ({ id, label, shortLabel, icon, href, pressed, run }, index) => {
            const point = offsets?.[index];
            const props = {
              className: "quick-action",
              "aria-label": label,
              title: offsets ? label : undefined,
              style: point
                ? { left: size / 2 + point.x, top: size / 2 + point.y }
                : undefined,
              onClick: run,
            };
            const content = (
              <>
                <Icon name={icon} />
                <span>{offsets ? (shortLabel ?? label) : label}</span>
              </>
            );
            if (href?.startsWith("/"))
              return (
                <Link key={id} href={href} {...props}>
                  {content}
                </Link>
              );
            if (href)
              return (
                <a key={id} href={href} {...props}>
                  {content}
                </a>
              );
            return (
              <Button key={id} aria-pressed={pressed} {...props}>
                {content}
              </Button>
            );
          },
        )}
      </PopoverContent>
    </Popover>
  );
}
