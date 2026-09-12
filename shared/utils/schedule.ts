/**
 * Раскладка дня по часам.
 *
 * Блок с окном «с — по» стоит колом: созвон в 17:00 остаётся в 17:00,
 * во сколько бы ни стартовал день. Остальные — плавающие: идут подряд от начала
 * дня в порядке списка и обтекают фиксированные, а не налезают на них.
 *
 * Считается на лету и нигде не хранится: иначе расчётное время расходится
 * с настоящим планом при первой же правке.
 */

/** Начало дня, если он ещё не начат: до старта отсчитывать не от чего */
export const DEFAULT_DAY_START_MIN = 9 * 60;

export type Plannable = {
  id: number;
  plannedMin: number | null;
  plannedStartMin: number | null;
  plannedEndMin: number | null;
  status: string;
};

export type Slot = {
  id: number;
  startMin: number;
  endMin: number;
  /** true — время задано руками и не сдвигается */
  fixed: boolean;
};

/** Отработанное место в дне больше не занимает: факт по нему уже нарисован */
const counts = (b: Plannable) => b.status !== "done" && b.status !== "dropped";

const hasWindow = (b: Plannable) => b.plannedStartMin != null && b.plannedEndMin != null;

/**
 * @param blocks в том порядке, в каком они лежат в дне
 * @param dayStartMin начало дня в минутах от полуночи
 */
export function scheduleDay(blocks: Plannable[], dayStartMin = DEFAULT_DAY_START_MIN): Slot[] {
  const busy = blocks
    .filter((b) => counts(b) && hasWindow(b))
    .map((b) => ({ start: b.plannedStartMin!, end: b.plannedEndMin! }))
    .sort((a, b) => a.start - b.start);

  const out: Slot[] = [];
  let cursor = dayStartMin;

  for (const b of blocks) {
    if (!counts(b)) continue;

    if (hasWindow(b)) {
      out.push({ id: b.id, startMin: b.plannedStartMin!, endMin: b.plannedEndMin!, fixed: true });
      continue;
    }

    const length = b.plannedMin ?? 0;
    // без длительности ставить нечего: такой блок в сетке не показывается
    if (length <= 0) continue;

    // сдвигаем начало за каждое занятое окно, на которое налезли
    for (let guard = 0; guard < busy.length + 1; guard++) {
      const clash = busy.find((w) => cursor < w.end && cursor + length > w.start);
      if (!clash) break;
      cursor = clash.end;
    }

    // за полночь план не уезжает — дальше день кончился
    if (cursor + length > 24 * 60) break;

    out.push({ id: b.id, startMin: cursor, endMin: cursor + length, fixed: false });
    cursor += length;
  }

  return out;
}

/** Минуты от полуночи для метки времени; для чужого часового пояса не годится */
export function minutesOfDay(iso: string) {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
