import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tauri-apps/api/core": path.resolve(
        __dirname,
        "./src/lib/electron/tauri-core.ts"
      ),
      "@tauri-apps/api/event": path.resolve(
        __dirname,
        "./src/lib/electron/tauri-event.ts"
      ),
      "@tauri-apps/api/window": path.resolve(
        __dirname,
        "./src/lib/electron/tauri-window.ts"
      ),
      "@tauri-apps/api/webviewWindow": path.resolve(
        __dirname,
        "./src/lib/electron/tauri-webview-window.ts"
      ),
      "@tauri-apps/plugin-autostart": path.resolve(
        __dirname,
        "./src/lib/electron/plugin-autostart.ts"
      ),
      "@tauri-apps/plugin-http": path.resolve(
        __dirname,
        "./src/lib/electron/plugin-http.ts"
      ),
      "@tauri-apps/plugin-opener": path.resolve(
        __dirname,
        "./src/lib/electron/plugin-opener.ts"
      ),
      "@tauri-apps/plugin-process": path.resolve(
        __dirname,
        "./src/lib/electron/plugin-process.ts"
      ),
      "@tauri-apps/plugin-sql": path.resolve(
        __dirname,
        "./src/lib/electron/plugin-sql.ts"
      ),
      "@tauri-apps/plugin-updater": path.resolve(
        __dirname,
        "./src/lib/electron/plugin-updater.ts"
      ),
      "tauri-plugin-posthog-api": path.resolve(
        __dirname,
        "./src/lib/electron/posthog.ts"
      ),
      "tauri-plugin-macos-permissions-api": path.resolve(
        __dirname,
        "./src/lib/electron/macos-permissions.ts"
      ),
    },
  },
  clearScreen: false,
  server: {
    port: Number(process.env.PHANTOM_DEV_PORT || 1420),
    strictPort: true,
  },
}));
