import { db } from "../../utils/db";
import { presets } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertKind, cleanName } from "../../utils/presets";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{ kind: string; name: string }>(event);
  const kind = assertKind(body.kind);
  const name = cleanName(body.name);

  // повтор — не ошибка: шаблон с таким именем уже есть, и это ровно то, чего хотели
  const [created] = await db
    .insert(presets)
    .values({ userId, kind, name })
    .onConflictDoNothing()
    .returning();

  return created ?? { ok: true };
});
