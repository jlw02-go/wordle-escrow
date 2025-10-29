// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)), // allows "@/..." imports
    },
  },
  server: {
    port: 5173, // optional: set your dev port
  },
  build: {
    sourcemap: true, // enables readable stack traces in browser console
    outDir: "dist",
  },
});
