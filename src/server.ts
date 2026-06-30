import handler from "@tanstack/react-start/server-entry";
import { FastResponse } from "srvx";

import { paraglideMiddleware } from "./paraglide/server.js";

globalThis.Response = FastResponse;

export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req));
  },
};
