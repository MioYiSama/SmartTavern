import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { NodeFS } from "@electric-sql/pglite/nodefs";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

export const db = drizzle({
  client: await PGlite.create({
    fs: new NodeFS("data/pg"),
    extensions: { vector },
  }),
});

await migrate(db, {
  migrationsFolder: "./drizzle",
});
