import { drizzle } from "drizzle-orm/pglite";

export const db = drizzle(process.env.DATABASE_URL!, {});
