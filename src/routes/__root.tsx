import { aiDevtoolsPlugin } from "@tanstack/react-ai-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { StrictMode } from "react";

import { PWARegister } from "@/components/PWARegister";
import { getLocale } from "@/paraglide/runtime";

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
        name: "theme-color",
        content: "#ffffff",
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
      // VitePWA injects this into a static index.html, which a TanStack Start
      // SSR app does not have, so the manifest must be linked manually.
      // Without it Chrome cannot mark the app as installable.
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-icon-192x192.png",
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
            <PWARegister />
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
