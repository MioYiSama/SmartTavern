#!/usr/bin/env node
/**
 * Regenerate the @openrouter/sdk patch that strips broken `sourceMappingURL`
 * comments. The published package ships `//# sourceMappingURL=*.map` pragmas
 * but no `.map` files, so bundlers/dev servers spam "failed to load source map".
 *
 * This script is idempotent: run it after bumping @openrouter/sdk to refresh
 * `patches/@openrouter__sdk@<version>.patch`.
 *
 *   pnpm patch:openrouter
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = "@openrouter/sdk";
const SOURCE_MAP_LINE = /^\/\/# sourceMappingURL=.*$\n?/gm;

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...opts,
  });
}

function resolveVersions() {
  // The dep is transitive and not hoisted to top-level node_modules, so read
  // the versions pnpm actually installed straight from the lockfile. Keys look
  // like `'@openrouter/sdk@0.13.20':` or `'@openrouter/sdk@0.13.20(patch_hash=…)':`.
  const lock = readFileSync(join(rootDir, "pnpm-lock.yaml"), "utf8");
  const re = new RegExp(`${PKG.replace("/", "\\/")}@([0-9][^'"()\\s]*)`, "g");
  const versions = new Set();
  for (const [, version] of lock.matchAll(re)) versions.add(version);
  if (versions.size === 0) throw new Error(`${PKG} not found in pnpm-lock.yaml`);
  return [...versions];
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function stripSourceMaps(dir) {
  let filesChanged = 0;
  let linesRemoved = 0;
  for (const file of walk(dir)) {
    if (!/\.(js|cjs|mjs|ts|tsx)$/.test(file)) continue;
    const before = readFileSync(file, "utf8");
    if (!before.includes("sourceMappingURL")) continue;
    const matches = before.match(SOURCE_MAP_LINE);
    if (!matches) continue;
    writeFileSync(file, before.replace(SOURCE_MAP_LINE, ""));
    filesChanged += 1;
    linesRemoved += matches.length;
  }
  return { filesChanged, linesRemoved };
}

const versions = resolveVersions();
console.log(`Found ${PKG} version(s): ${versions.join(", ")}`);

for (const version of versions) {
  const spec = `${PKG}@${version}`;
  console.log(`\nPatching ${spec} …`);

  const editDir = mkdtempSync(join(tmpdir(), "openrouter-sdk-patch-"));
  try {
    run("pnpm", ["patch", spec, "--edit-dir", editDir]);

    const { filesChanged, linesRemoved } = stripSourceMaps(editDir);
    console.log(
      `Removed ${linesRemoved} sourceMappingURL comment(s) across ${filesChanged} file(s).`,
    );

    if (linesRemoved === 0) {
      console.log("Nothing to patch — package has no broken source maps. Skipping commit.");
    } else {
      run("pnpm", ["patch-commit", editDir]);
      console.log(`Done. Patch written for ${spec}.`);
    }
  } finally {
    rmSync(editDir, { recursive: true, force: true });
  }
}
