import { execSync } from "node:child_process";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import packageJson from "./package.json" with { type: "json" };

function maybeReadGitCommit(): string | null {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const maybeCommit = maybeReadGitCommit();
const buildTime = new Date().toISOString();
const isGitHubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGitHubPages ? "/timelapse-maker/" : "/",
  plugins: [solid()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_COMMIT__: JSON.stringify(maybeCommit ?? "Unavailable"),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.vitest.tsx"],
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
  },
});
