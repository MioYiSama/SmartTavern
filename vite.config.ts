import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { nitro } from "nitro/vite";
import Icons from "unplugin-icons/vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      strategy: ["preferredLanguage", "baseLocale"],
    }),
    tailwindcss(),
    tanstackStart({
      rsc: { enabled: true },
      importProtection: { behavior: "error" },
    }),
    rsc(),
    nitro({ defaultPreset: "node-server" }),
    Icons({
      compiler: "jsx",
      jsx: "react",
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.ico", "apple-icon-*.png"],
      // The real service worker is generated post-build against `.output/public`
      // by `scripts/generate-sw.mjs`, because VitePWA's build hook targets `dist`,
      // which doesn't match where the RSC/nitro pipeline emits client assets.
      // VitePWA is kept here only for the manifest and `virtual:pwa-register`.
      // An empty glob avoids precaching against the wrong (empty) `dist` dir.
      workbox: {
        globPatterns: [],
        // SSR app: navigations always hit the server, so there is no
        // `index.html` to precache. Disable the default navigation fallback
        // (`navigateFallback: "index.html"`) to avoid the runtime
        // `non-precached-url` error from `createHandlerBoundToURL`.
        navigateFallback: undefined,
      },
      outDir: ".output/public",
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "SmartTavern",
        short_name: "SmartTavern",
        description: "SmartTavern",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/apple-icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/apple-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/apple-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 8000,
  },
  build: {
    modulePreload: {
      polyfill: false,
    },
  },
  lint: {
    ignorePatterns: ["src/routeTree.gen.ts"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ["src/routeTree.gen.ts"],
    sortImports: true,
    sortPackageJson: true,
    sortTailwindcss: true,
  },
});
