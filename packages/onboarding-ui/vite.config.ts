import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Onboarding UI runs at localhost:5173 by default.
// `npx wavex-os init` opens the browser here after `pnpm dev` boots the wizard.
// API calls go to the local Paperclip core (localhost:3100) and the hosted backend
// (api.wavex-os.dev — TBD) via the onboarding-server-client package.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Bind explicitly to 127.0.0.1 (IPv4) — macOS Vite defaults to IPv6-only,
    // which can prevent localhost connections from tooling that prefers IPv4.
    host: "127.0.0.1",
    open: false, // installer opens the browser; vite shouldn't double-open
    proxy: {
      "/api/paperclip": {
        target: process.env.WAVEX_CORE_URL ?? "http://127.0.0.1:3101",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/paperclip/, "/api"),
      },
      "/api": {
        target: process.env.WAVEX_CORE_URL ?? "http://127.0.0.1:3101",
        changeOrigin: true,
      },
      "/op-omega": {
        target: process.env.WAVEX_CORE_URL ?? "http://127.0.0.1:3101",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
