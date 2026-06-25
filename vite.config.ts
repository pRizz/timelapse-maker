import { execSync } from "node:child_process";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";
import packageJson from "./package.json" with { type: "json" };

function maybeReadGitCommit(): string | null {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }

  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function maybeNormalizeGitHubRepositoryUrl(maybeUrl: string | undefined): string | null {
  if (!maybeUrl) {
    return null;
  }

  const httpsMatch = maybeUrl.match(/^(?:git\+)?https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return `https://github.com/${httpsMatch[1]}`;
  }

  const sshMatch = maybeUrl.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}`;
  }

  return null;
}

function maybeGitHubRepositoryBaseUrl(): string | null {
  const maybeServerUrl = process.env.GITHUB_SERVER_URL;
  const maybeRepository = process.env.GITHUB_REPOSITORY;

  if (maybeServerUrl && maybeRepository) {
    return `${maybeServerUrl}/${maybeRepository}`;
  }

  return maybeNormalizeGitHubRepositoryUrl(packageJson.repository?.url);
}

function buildCommitUrl(maybeRepositoryUrl: string | null, maybeCommitHash: string | null): string {
  if (!maybeRepositoryUrl || !maybeCommitHash) {
    return "";
  }

  return `${maybeRepositoryUrl}/commit/${maybeCommitHash}`;
}

function buildRunUrl(maybeRepositoryUrl: string | null): string {
  if (!maybeRepositoryUrl || !process.env.GITHUB_RUN_ID) {
    return "";
  }

  return `${maybeRepositoryUrl}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

const maybeCommit = maybeReadGitCommit();
const maybeRepositoryUrl = maybeGitHubRepositoryBaseUrl();
const buildTime = new Date().toISOString();
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const appBasePath = isGitHubPages ? "/timelapse-maker/" : "/";

export default defineConfig({
  base: appBasePath,
  plugins: [
    solid(),
    VitePWA({
      includeManifestIcons: false,
      injectRegister: "auto",
      registerType: "autoUpdate",
      manifest: {
        name: "Timelapse Maker",
        short_name: "Timelapse",
        description:
          "Convert local iPhone, MP4, and MOV videos into downloadable timelapse videos in your browser.",
        start_url: appBasePath,
        scope: appBasePath,
        display: "standalone",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",
        categories: ["utilities", "photo", "video"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ["**/*.{html,js,css,png,svg,txt,xml}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: `${appBasePath}index.html`,
        skipWaiting: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_COMMIT__: JSON.stringify(maybeCommit ?? "Unavailable"),
    __BUILD_COMMIT_URL__: JSON.stringify(buildCommitUrl(maybeRepositoryUrl, maybeCommit)),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __BUILD_RUN_URL__: JSON.stringify(buildRunUrl(maybeRepositoryUrl)),
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.vitest.tsx"],
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
  },
});
