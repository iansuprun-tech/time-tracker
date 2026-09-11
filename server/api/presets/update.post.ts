import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { presets } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertKind, assertOwnPreset, cleanName, renameInBlocks } from "../../utils/presets";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{ id: number; name: string }>(event);

  const preset = await assertOwnPreset(userId, body.id);
  const name = cleanName(body.name);
  if (name === preset.name) return { ok: true };

  const kind = assertKind(preset.kind);
  await db.update(presets).set({ name }).where(eq(presets.id, preset.id));
  await renameInBlocks(userId, kind, preset.name, name);

  return { ok: true };
});
