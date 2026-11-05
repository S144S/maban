import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

export default defineConfig({
  server: { host: "127.0.0.1", port: 6201, strictPort: true, proxy: { "/api": "http://127.0.0.1:6202" } },
  preview: { host: "127.0.0.1", port: 6201, strictPort: true, proxy: { "/api": "http://127.0.0.1:6202" } },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: {
    __APP_VERSION__: JSON.stringify(
      readFileSync(new URL("./VERSION", import.meta.url), "utf8").trim(),
    ),
  },
});
