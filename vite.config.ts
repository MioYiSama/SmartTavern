import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { nitro } from "nitro/vite";
import Icons from "unplugin-icons/vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite-plus";

const pgliteExternals = ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"];

export default defineConfig(() => ({
  test: {
    include: ["src/**/*.test.ts"],
  },
  server: { port: 8000 },
  preview: { port: 8000 },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "shiki/wasm": "@shikijs/engine-oniguruma/wasm-inlined",
    },
  },
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: "./src/project.inlang",
      outdir: "./src/paraglide",
      strategy: ["preferredLanguage", "baseLocale"],
    }),
    tailwindcss(),
    tanstackStart({
      rsc: { enabled: true },
      importProtection: { behavior: "error" },
    }),
    rsc(),
    nitro({
      defaultPreset: "node-server",
      compressPublicAssets: { gzip: true, zstd: true },
      traceDeps: pgliteExternals,
    }),
    Icons({ compiler: "jsx", jsx: "react" }),
    react(),
    babel({ presets: [reactCompilerPreset()] }) as any, // ts(2321)
    tanstackStartCookies(),
    ...VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      injectRegister: "script",
      outDir: ".output/public",
      workbox: {
        navigateFallback: undefined,
      },
      manifest: {
        name: "SmartTavern",
        short_name: "SmartTavern",
        description: "A fork of SillyTavern.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }).map((plugin) => ({
      ...plugin,
      applyToEnvironment: (
        environment: Parameters<NonNullable<typeof plugin.applyToEnvironment>>[0],
      ) => environment.name === "client",
    })),
  ],
  environments: {
    rsc: {
      resolve: {
        external: pgliteExternals,
      },
    },
    ssr: {
      resolve: {
        external: pgliteExternals,
      },
    },
  },
  optimizeDeps: {
    exclude: pgliteExternals,
  },
  build: {
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: Number.MAX_SAFE_INTEGER,
  },
  lint: {
    ignorePatterns: ["src/routeTree.gen.ts", "SillyTavern/**/*"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ["src/routeTree.gen.ts", "pnpm-lock.yaml", "SillyTavern/**/*"],
    sortImports: true,
    sortPackageJson: true,
    sortTailwindcss: true,
  },
}));
