"use client";

import { Button } from "./button";
import { Input } from "./input";
import { enUS, ja, ko, zhCN, zhTW } from "date-fns/locale";
import { useState } from "react";
import { parseDate } from "../../lib/dates";
import { Icon } from "../icon";
import { useApp } from "../providers";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const calendarLocales = { "zh-CN": zhCN, "zh-Hant": zhTW, en: enUS, ja, ko };
const firstMonth = parseDate("0001-01-01");
const lastMonth = parseDate("9999-12-01");
const outsideDateRange = [
  { before: firstMonth },
  { after: parseDate("9999-12-31") },
];

export function DatePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { locale, t } = useApp();
  const [open, setOpen] = useState(false);
  let selected: Date | undefined;
  try {
    selected = parseDate(value);
  } catch {
    // Keep the text editable while the user enters a complete date.
  }

  return (
    <div className="date-picker">
      <Input
        className="field"
        id={id}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            className="date-picker-trigger"
            aria-label={t("打开日历")}
          >
            <Icon name="calendar" />
          </Button>
        </PopoverTrigger>
        <PopoverContent aria-label={t("打开日历")}>
          <Calendar
            mode="single"
            required
            autoFocus
            locale={calendarLocales[locale]}
            timeZone="UTC"
            selected={selected}
            defaultMonth={selected}
            startMonth={firstMonth}
            endMonth={lastMonth}
            hidden={outsideDateRange}
            onSelect={(day) => {
              onChange(day.toISOString().slice(0, 10));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
