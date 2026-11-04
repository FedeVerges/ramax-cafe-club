import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: "../..",
  server: {
    port: 5173,
    proxy: {
      "/api/v1/club": "http://localhost:3200",
      "/api": "http://localhost:3000",
    },
  },
});
