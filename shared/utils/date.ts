/** Локальная дата YYYY-MM-DD — день считается по месту, где живёт пользователь, а не по UTC */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDate(d);
}

/** Дата, сдвинутая на n дней; n может быть отрицательным */
export function shiftDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y!, m! - 1, d! + n));
}

/** Следующий день от переданной даты */
export function nextDay(date: string) {
  return shiftDays(date, 1);
}

/** Понедельник той недели, в которую попадает дата */
export function weekStart(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y!, m! - 1, d!).getDay();
  return shiftDays(date, -((dow + 6) % 7));
}

/** «10:30» → 630. Пустое или кривое время — null */
export function hhmmToMin(value: string | null | undefined) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 0 && min <= 1440 ? min : null;
}

/** 630 → «10:30» */
export function minToHhmm(min: number) {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min) % 60).padStart(2, "0")}`;
}
