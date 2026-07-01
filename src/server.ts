import handler from "@tanstack/react-start/server-entry";
import { migrate } from "drizzle-orm/pglite/migrator";
import { FastResponse } from "srvx";

import { db } from "./db";
import { paraglideMiddleware } from "./paraglide/server.js";

globalThis.Response = FastResponse;

await migrate(db, { migrationsFolder: "drizzle" });

export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
};
