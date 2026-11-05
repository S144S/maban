const solar = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran",
});
export const persianMonths = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const minPersianYear = 1403;
export const maxPersianYear = 1498;
export const persianNumber = (value: number) => new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
export function calendarDate(year: number, month: number, day: number) {
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}
export function persianMonthInfo(year: number, month: number) {
  const first = parseReminderDate(calendarDate(year, month, 1), "12:00");
  if (!first) throw new RangeError("Unsupported Persian month");
  const days = month <= 6 ? 31 : month < 12 ? 30 : parseReminderDate(calendarDate(year, month, 30), "12:00") ? 30 : 29;
  return { days, offset: (new Date(first).getUTCDay() + 1) % 7 };
}
const clock = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Tehran",
});

function digits(value: string) {
  return value.replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function reminderDateFields(value: string) {
  const date = new Date(value);
  const parts = solar.formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return { date: `${part("year")}/${part("month")}/${part("day")}`, time: clock.format(date) };
}

// Intl validates the actual Persian calendar, including Esfand in leap years.
export function parseReminderDate(dateText: string, timeText: string): string | null {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(digits(dateText.trim()));
  const time = /^(\d{1,2}):(\d{2})$/.exec(digits(timeText.trim()));
  if (!match || !time) return null;
  const [, y, m, d] = match.map(Number);
  const hour = Number(time[1]), minute = Number(time[2]);
  if (y < 1403 || y > 1498 || m < 1 || m > 12 || d < 1 || d > 31 || hour > 23 || minute > 59) return null;
  const dayOffset = (m <= 6 ? (m - 1) * 31 : 186 + (m - 7) * 30) + d - 1;
  for (let adjustment = -2; adjustment <= 2; adjustment++) {
    const candidate = new Date(Date.UTC(y + 621, 2, 21 + dayOffset + adjustment, 12));
    if (reminderDateFields(candidate.toISOString()).date === `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`) {
      // Tehran has a fixed UTC+03:30 offset in the supported range (1403 onward).
      return `${candidate.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+03:30`;
    }
  }
  return null;
}

export function formatReminderDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tehran",
  }).format(new Date(value));
}
