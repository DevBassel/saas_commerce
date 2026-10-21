import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

function manualChunks(id: string) {
  const chunkPath = id.replace(/\\/g, "/");

  // Dynamic, dev-only chunk. Must stay separate from `refine`.
  if (chunkPath.includes("/node_modules/@refinedev/devtools/")) {
    return "devtools";
  }

  // React internals must share one chunk to keep execution order stable.
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(chunkPath)) {
    return "react";
  }

  // Initial Refine runtime and its adapters. `devtools-shared` and
  // `devtools-internal` are part of core's runtime path, not the UI panel.
  if (
    /\/node_modules\/@refinedev\/(core|devtools-internal|devtools-shared|react-router|kbar)\//.test(
      chunkPath,
    ) ||
    chunkPath.includes("/node_modules/@tanstack/react-query/") ||
    chunkPath.includes("/node_modules/kbar/")
  ) {
    return "refine";
  }

  if (chunkPath.includes("/node_modules/react-router/")) {
    return "router";
  }

  // Loaded only by list routes.
  if (
    chunkPath.includes("/node_modules/@refinedev/react-table/") ||
    chunkPath.includes("/node_modules/@tanstack/react-table/")
  ) {
    return "tables";
  }

  // Loaded only by login/create/edit routes.
  if (
    /\/node_modules\/(react-hook-form|@hookform\/resolvers|zod)\//.test(chunkPath)
  ) {
    return "forms";
  }

  if (/\/node_modules\/(axios|jwt-decode)\//.test(chunkPath)) {
    return "http";
  }

  return undefined;
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const standalone = process.env.BUILD_STANDALONE === "true";
  const embedded = command === "build" && !standalone;

  return {
    base: embedded ? "/platform/" : "/",
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: embedded
        ? path.resolve(__dirname, "../api/static")
        : path.resolve(__dirname, "dist"),
      emptyOutDir: standalone,
      rollupOptions: {
        output: { manualChunks },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
