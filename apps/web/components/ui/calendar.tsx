"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";

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
