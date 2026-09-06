import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";
import { stopRunning } from "../../utils/day";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  const body = await readBody<{ status?: string; actualMin?: number | null; title?: string }>(event);

  if (body.status && body.status !== "doing") await stopRunning();

  await db
    .update(blocks)
    .set({
      ...(body.status ? { status: body.status } : {}),
      ...(body.title ? { title: body.title } : {}),
      ...(body.actualMin !== undefined ? { actualMin: body.actualMin } : {}),
    })
    .where(eq(blocks.id, id));

  return { ok: true };
});
