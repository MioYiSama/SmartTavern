import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"],
  dialect: "postgresql",
  driver: "pglite",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
