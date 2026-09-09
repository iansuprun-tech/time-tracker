import { inArray, sql } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { requireUserId } from "../../utils/session";
import { assertOwnBlocks } from "../../utils/access";
import { fail } from "../../utils/http";

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event);
  const body = await readBody<{ ids: number[] }>(event);
  const ids = [...new Set((body.ids ?? []).map(Number))].filter(Number.isInteger);
  if (!ids.length) throw fail(400, "Пустой порядок");

  await assertOwnBlocks(userId, ids);

  // один UPDATE на весь список: до базы далеко, а строк столько же, сколько блоков
  const cases = sql.join(
    ids.map((id, i) => sql`when ${blocks.id} = ${id} then ${i + 1}::int`),
    sql` `,
  );
  await db
    .update(blocks)
    .set({ sort: sql`case ${cases} end` })
    .where(inArray(blocks.id, ids));

  return { ok: true };
});
