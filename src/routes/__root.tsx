import { aiDevtoolsPlugin } from "@tanstack/react-ai-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { StrictMode } from "react";

import { getLocale } from "../paraglide/runtime";

import css from "../app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "SmartTavern",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: css,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
  component() {
    return (
      <html lang={getLocale()}>
        <head>
          <HeadContent />
        </head>
        <body>
          <StrictMode>
            <Outlet />
            <TanStackDevtools
              plugins={[
                {
                  name: "TanStack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
                aiDevtoolsPlugin(),
              ]}
              eventBusConfig={{
                connectToServerBus: true,
              }}
            />
          </StrictMode>
          <Scripts />
        </body>
      </html>
    );
  },
});
