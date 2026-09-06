import type { BlockDto } from "./day";

type Note = { blockId: number | null; text: string };

function human(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function line(b: BlockDto, notes: Note[]) {
  const fact = b.actualMin ?? b.trackedMin;
  const parts: string[] = [b.title];

  if (b.status === "done" && fact > 0) parts.push(`(${fact}м)`);
  // у незакрытого важно показать, сколько уже вложено против плана
  else if (b.status !== "done" && b.plannedMin && fact > 0) parts.push(`(${fact}м из ${b.plannedMin}м)`);
  else if (b.status !== "done" && fact > 0) parts.push(`(${fact}м)`);

  const own = notes.filter((n) => n.blockId === b.id).map((n) => n.text);
  const text = `— ${parts.join(" ")}`;
  return own.length ? `${text}: ${own.join("; ")}` : text;
}

/**
 * Текст для стендапа. Собирается из данных дня без ручного пересказа —
 * ради этого экрана трекер и заполняют.
 */
export function buildStandup(args: {
  date: string;
  blocks: BlockDto[];
  notes: Note[];
  tomorrow: BlockDto[];
}) {
  const { date, blocks, notes, tomorrow } = args;

  const done = blocks.filter((b) => b.status === "done");
  const blocked = blocks.filter((b) => b.status === "blocked");
  const open = blocks.filter((b) => b.status !== "done" && b.status !== "blocked" && b.status !== "dropped");

  const out: string[] = [`Стендап · ${human(date)}`];

  if (done.length) out.push("", "Сделано:", ...done.map((b) => line(b, notes)));
  if (open.length) out.push("", "Не закрыто:", ...open.map((b) => line(b, notes)));
  if (blocked.length) out.push("", "Блокеры:", ...blocked.map((b) => line(b, notes)));
  if (tomorrow.length) {
    out.push(
      "",
      "Завтра:",
      ...tomorrow.map((b) => `— ${b.title}${b.plannedMin ? ` (${b.plannedMin}м)` : ""}`),
    );
  }
  if (out.length === 1) out.push("", "Пусто — блоков за день не было.");

  return out.join("\n");
}
