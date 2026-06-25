import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "forks",           // required for ESM modules
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
    },
  },
  resolve: {
    // map workspace package to its compiled output
    alias: {
      "@celeris/shared": new URL("../../packages/shared/src/index.ts", import.meta.url).pathname,
    },
  },
});
