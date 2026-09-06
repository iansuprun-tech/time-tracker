import type { Config } from "drizzle-kit";

export default {
  schema: "./server/utils/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
