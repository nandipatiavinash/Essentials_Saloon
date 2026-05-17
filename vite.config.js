import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

function adminFallback() {
  return {
    name: "admin-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith("/admin") && !req.url.includes(".")) req.url = "/admin.html";
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith("/admin") && !req.url.includes(".")) req.url = "/admin.html";
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [adminFallback(), react()],
  root: ".",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html")
      }
    },
    chunkSizeWarningLimit: 800,
  },
});
