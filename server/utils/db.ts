import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });

/** MVP на одного пользователя — авторизация появится вместе с командой */
export const CURRENT_USER_ID = 1;
