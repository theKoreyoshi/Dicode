// Builds dicode.exe via Node.js SEA (Single Executable Application).
// Bundles the CLI + TUI + Core + Adapter into one CJS file, then injects it
// into a copy of the Node binary.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ROOT = process.cwd();
const DIST = join(ROOT, "dist", "sea");
const NODE_EXE = process.execPath;
const OUT_EXE = join(ROOT, "release", "dicode.exe");

mkdirSync(DIST, { recursive: true });
mkdirSync(join(ROOT, "release"), { recursive: true });

const alias = {
  "@dicode/shared": resolve(ROOT, "packages/shared/src/index.ts"),
  "@dicode/codex-adapter": resolve(ROOT, "packages/codex-adapter/src/index.ts"),
  "@dicode/core": resolve(ROOT, "packages/core/src/index.ts"),
  "@dicode/tui": resolve(ROOT, "packages/tui/src/index.ts"),
  "@dicode/cli": resolve(ROOT, "packages/cli/src/index.ts"),
  "react-devtools-core": resolve(ROOT, "tools/stubs/react-devtools-core.js"),
};

console.log("[1/4] bundling with esbuild...");
await build({
  entryPoints: [resolve(ROOT, "packages/cli/src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: join(DIST, "bundle.mjs"),
  alias,
  jsx: "automatic",
  minify: false,
  sourcemap: false,
  banner: {
    js: "globalThis.DICODE_SEA = true;",
  },
});

console.log("[2/4] writing sea-config.json...");
writeFileSync(
  join(DIST, "sea-config.json"),
  JSON.stringify({ main: join(DIST, "bundle.mjs"), output: join(DIST, "sea-prep.blob") }),
  "utf8",
);

console.log("[3/4] generating SEA blob...");
execFileSync(process.execPath, ["--experimental-sea-config", join(DIST, "sea-config.json")], {
  stdio: "inherit",
  shell: false,
});

console.log("[4/4] injecting blob into", OUT_EXE, "...");
copyFileSync(NODE_EXE, OUT_EXE);
const postject = require.resolve("postject/dist/cli.js");
execFileSync(process.execPath, [
  postject,
  OUT_EXE,
  "NODE_SEA_BLOB",
  join(DIST, "sea-prep.blob"),
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
], { stdio: "inherit", shell: false });

console.log("DONE:", OUT_EXE);
console.log("size:", existsSync(OUT_EXE) ? `${(readFileSync(OUT_EXE).length / 1e6).toFixed(1)}MB` : "missing");
