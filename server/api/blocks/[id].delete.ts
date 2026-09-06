import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { blocks } from "../../utils/schema";

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, "id"));
  await db.delete(blocks).where(eq(blocks.id, id));
  return { ok: true };
});
