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
    open: false, // installer opens the browser; vite shouldn't double-open
    proxy: {
      // Proxy local Paperclip calls during dev so we share an origin
      "/api/paperclip": {
        target: "http://127.0.0.1:3100",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/paperclip/, "/api"),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
