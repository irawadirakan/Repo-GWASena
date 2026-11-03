import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Semua request ke /api diteruskan ke backend FastAPI (Unified Web)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
