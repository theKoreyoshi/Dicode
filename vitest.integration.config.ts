import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@dicode/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
  "@dicode/codex-adapter": fileURLToPath(new URL("./packages/codex-adapter/src/index.ts", import.meta.url)),
  "@dicode/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
  "@dicode/tui": fileURLToPath(new URL("./packages/tui/src/index.ts", import.meta.url)),
  "@dicode/cli": fileURLToPath(new URL("./packages/cli/src/index.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  plugins: [
    {
      name: "externalize-node-sqlite",
      resolveId(id) {
        if (id === "node:sqlite" || id === "sqlite") {
          return { id: "node:sqlite", external: true };
        }
        return null;
      },
    },
  ],
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 300_000,
    hookTimeout: 120_000,
  },
});
