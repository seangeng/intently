import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  build: {
    rollupOptions: {
      // Multi-page: real documents so intently can prefetch/prerender between them.
      input: {
        index: "index.html",
        docs: "docs.html",
        lab: "lab.html",
      },
    },
  },
});
