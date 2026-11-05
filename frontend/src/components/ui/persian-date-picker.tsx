import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { calendarDate, maxPersianYear, minPersianYear, parseReminderDate, persianMonthInfo, persianMonths, persianNumber, reminderDateFields } from "@/lib/persian-date";
import "./persian-date-picker.css";

const weekdays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

export function PersianDatePicker({ id, name, defaultValue = "", required = false, disabled = false }: {
  id: string; name: string; defaultValue?: string; required?: boolean; disabled?: boolean;
}) {
  const panelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const today = reminderDateFields(new Date().toISOString()).date;
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const selected = parseReminderDate(value, "12:00");
  const normalized = selected ? reminderDateFields(selected).date : "";
  const [year, setYear] = useState(Number((normalized || today).split("/")[0]));
  const [month, setMonth] = useState(Number((normalized || today).split("/")[1]));
  const [focusedDay, setFocusedDay] = useState(Number((normalized || today).split("/")[2]));
  const { days, offset } = persianMonthInfo(year, month);

  function close() { setOpen(false); input.current?.focus(); }
  function choose(date: string) { setValue(date); close(); }
  function show() {
    const [y, m, d] = (normalized || today).split("/").map(Number);
    setYear(Math.max(minPersianYear, Math.min(maxPersianYear, y))); setMonth(m); setFocusedDay(d); setOpen(true);
  }
  function navigate(y: number, m: number, d = 1, focus = false) {
    if (y < minPersianYear || y > maxPersianYear) return;
    const day = Math.min(d, persianMonthInfo(y, m).days);
    setYear(y); setMonth(m); setFocusedDay(day);
    if (focus) requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus());
  }
  function shiftMonth(delta: number, day = 1, focus = false) {
    const index = year * 12 + month - 1 + delta;
    navigate(Math.floor(index / 12), index % 12 + 1, day, focus);
  }
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, day: number) {
    let next = day;
    if (event.key === "ArrowLeft") next++;
    else if (event.key === "ArrowRight") next--;
    else if (event.key === "ArrowDown") next += 7;
    else if (event.key === "ArrowUp") next -= 7;
    else if (event.key === "Home") next = Math.max(1, day - (offset + day - 1) % 7);
    else if (event.key === "End") next = Math.min(days, day + 6 - (offset + day - 1) % 7);
    else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault(); shiftMonth((event.key === "PageDown" ? 1 : -1) * (event.shiftKey ? 12 : 1), day, true); return;
    } else return;
    event.preventDefault();
    if (next > days) shiftMonth(1, next - days, true);
    else if (next < 1) {
      const y = month === 1 ? year - 1 : year, m = month === 1 ? 12 : month - 1;
      if (y >= minPersianYear) navigate(y, m, persianMonthInfo(y, m).days + next, true);
    } else navigate(year, month, next, true);
  }
  return <div className="persian-picker" data-calendar-open={open} dir="rtl" onKeyDown={event => {
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <label htmlFor={id}>تاریخ شمسی</label>
    <div className="persian-picker-field">
      <input ref={input} id={id} name={name} value={value} onChange={event => setValue(event.target.value)} disabled={disabled}
        dir="ltr" required={required} maxLength={10} placeholder="۱۴۰۵/۰۸/۲۰" aria-describedby={`${panelId}-help`} />
      <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label="انتخاب تاریخ از تقویم" aria-expanded={open} aria-controls={panelId} onClick={() => open ? close() : show()}><CalendarDays aria-hidden="true" /></Button>
    </div>
    <p id={`${panelId}-help`} className="persian-picker-help">از تقویم انتخاب کنین یا سال/ماه/روز رو بنویسین.</p>
    {open && <section id={panelId} className="persian-calendar" aria-label="تقویم شمسی">
      <div className="persian-calendar-nav">
        <Button type="button" variant="ghost" size="icon" aria-label="ماه قبل" disabled={disabled || year === minPersianYear && month === 1} onClick={() => shiftMonth(-1)}><ChevronRight aria-hidden="true" /></Button>
        <div className="persian-calendar-selects">
          <select aria-label="ماه" value={month} disabled={disabled} onChange={event => navigate(year, Number(event.target.value))}>{persianMonths.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
          <select aria-label="سال" value={year} disabled={disabled} onChange={event => navigate(Number(event.target.value), month)}>{Array.from({ length: maxPersianYear - minPersianYear + 1 }, (_, index) => minPersianYear + index).map(y => <option key={y} value={y}>{persianNumber(y)}</option>)}</select>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="ماه بعد" disabled={disabled || year === maxPersianYear && month === 12} onClick={() => shiftMonth(1)}><ChevronLeft aria-hidden="true" /></Button>
      </div>
      <span className="sr-only" aria-live="polite">{persianMonths[month - 1]} {persianNumber(year)}</span>
      <div className="persian-calendar-scroll">
        <div ref={grid} className="persian-calendar-grid" role="grid" aria-label={`${persianMonths[month - 1]} ${persianNumber(year)}`}>
          <div role="row" className="persian-calendar-week">{weekdays.map(day => <span role="columnheader" key={day} aria-label={day}>{day === "شنبه" ? "ش" : day === "جمعه" ? "ج" : day.slice(0, 1)}</span>)}</div>
          {Array.from({ length: Math.ceil((offset + days) / 7) }, (_, week) => <div role="row" className="persian-calendar-week" key={week}>
            {Array.from({ length: 7 }, (_, weekday) => {
              const day = week * 7 + weekday - offset + 1;
              if (day < 1 || day > days) return <span role="gridcell" key={weekday} />;
              const date = calendarDate(year, month, day);
              return <span role="gridcell" key={weekday} aria-selected={normalized === date}><button type="button" data-day={day} disabled={disabled}
                tabIndex={day === Math.min(focusedDay, days) ? 0 : -1} onFocus={() => setFocusedDay(day)}
                aria-label={`${weekdays[weekday]} ${persianNumber(day)} ${persianMonths[month - 1]} ${persianNumber(year)}`}
                aria-current={date === today ? "date" : undefined} className="persian-calendar-day"
                onKeyDown={event => keyDown(event, day)} onClick={() => choose(date)}>{persianNumber(day)}</button></span>;
            })}
          </div>)}
        </div>
      </div>
      <div className="persian-calendar-footer"><Button type="button" variant="outline" disabled={disabled || !parseReminderDate(today, "12:00")} onClick={() => choose(today)}>امروز</Button><Button type="button" variant="ghost" onClick={close}>بستن تقویم</Button></div>
    </section>}
  </div>;
}
