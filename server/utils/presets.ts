import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { blocks, days, presets } from "./schema";
import { fail } from "./http";

export const PRESET_KINDS = ["category", "place"] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

export function assertKind(kind: unknown): PresetKind {
  if (!PRESET_KINDS.includes(kind as PresetKind)) throw fail(400, "Неизвестный вид шаблона");
  return kind as PresetKind;
}

export function cleanName(name: unknown) {
  const value = String(name ?? "").trim().slice(0, 60);
  if (!value) throw fail(400, "Пустое название");
  return value;
}

/** Шаблон чужого пользователя не правится и не удаляется даже по прямому запросу */
export async function assertOwnPreset(userId: number, id: number) {
  const [row] = await db.select().from(presets).where(eq(presets.id, id));
  if (!row) throw fail(404, "Шаблон не найден");
  if (row.userId !== userId) throw fail(403, "Чужой шаблон");
  return row;
}

/**
 * Новое значение из блока запоминается само: иначе список шаблонов
 * приходится вести вручную, и им перестают пользоваться.
 */
export async function rememberPreset(userId: number, kind: PresetKind, name?: string | null) {
  const value = (name ?? "").trim();
  if (!value) return;
  await db.insert(presets).values({ userId, kind, name: value.slice(0, 60) }).onConflictDoNothing();
}

/** Переименование тянет за собой блоки: иначе старое значение остаётся в истории сиротой */
export async function renameInBlocks(userId: number, kind: PresetKind, from: string, to: string) {
  const column = kind === "place" ? blocks.location : blocks.category;
  await db
    .update(blocks)
    .set(kind === "place" ? { location: to } : { category: to })
    .where(
      and(
        eq(column, from),
        sql`${blocks.dayId} in (select ${days.id} from ${days} where ${days.userId} = ${userId})`,
      ),
    );
}

export async function listPresets(userId: number) {
  const rows = await db
    .select({ id: presets.id, kind: presets.kind, name: presets.name })
    .from(presets)
    .where(and(eq(presets.userId, userId), inArray(presets.kind, [...PRESET_KINDS])))
    .orderBy(presets.name);

  return {
    categories: rows.filter((r) => r.kind === "category"),
    places: rows.filter((r) => r.kind === "place"),
  };
}
