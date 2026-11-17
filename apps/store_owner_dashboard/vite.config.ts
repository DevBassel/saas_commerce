import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    allowedHosts: [
      "kate-immunology-img-bedroom.trycloudflare.com",
      ".trycloudflare.com",
    ],
  },
  preview: {
    port: 5174,
    strictPort: true,
    allowedHosts: [
      "kate-immunology-img-bedroom.trycloudflare.com",
      ".trycloudflare.com",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
