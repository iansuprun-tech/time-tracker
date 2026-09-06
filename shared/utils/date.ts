/** Локальная дата YYYY-MM-DD — день считается по месту, где живёт пользователь, а не по UTC */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDate(d);
}

/** Следующий день от переданной даты */
export function nextDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y!, m! - 1, d! + 1);
  return localDate(next);
}
