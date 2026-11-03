import { defineConfig } from "vitest/config";

// Every test in spec/ runs against the running app, which spec/global-setup.ts
// finds or boots. Only spec/ runs: a test anywhere else needs adding to `include`.
export default defineConfig({
  test: {
    include: ["spec/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
    // one spec file at a time: they share one server, and the resting count
    // and the meadow are everyone's, so a file resting at the same moment as
    // another changed what it read (2026-11-04)
    fileParallelism: false,
  },
});
