import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { presets } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertOwnPreset } from "../../utils/presets";

/** Убирает шаблон из подсказок. Блоки, где это значение уже стоит, не трогаются */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const { id } = await readBody<{ id: number }>(event);

  await assertOwnPreset(userId, id);
  await db.delete(presets).where(eq(presets.id, id));

  return { ok: true };
});
