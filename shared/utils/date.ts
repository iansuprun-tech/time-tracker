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
