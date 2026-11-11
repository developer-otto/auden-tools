"use client";

import { enUS, ja, ko, zhCN, zhTW } from "date-fns/locale";
import { DayPicker, type DayPickerProps } from "react-day-picker";

export const calendarLocales = {
  "zh-CN": zhCN,
  "zh-Hant": zhTW,
  en: enUS,
  ja,
  ko,
};

export function Calendar(props: DayPickerProps) {
  return (
    <DayPicker
      data-slot="calendar"
      className="ui-calendar"
      showOutsideDays
      {...props}
    />
  );
}
