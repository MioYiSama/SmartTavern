import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { NodeFS } from "@electric-sql/pglite/nodefs";
import { drizzle } from "drizzle-orm/pglite";

export const db = drizzle({
  client: await PGlite.create({
    fs: new NodeFS(process.env.DATABASE_URL!),
    extensions: {
      vector,
    },
  }),
});
