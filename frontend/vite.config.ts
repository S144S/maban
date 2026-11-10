import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

export default defineConfig({
  server: { host: "127.0.0.1", port: 6201, strictPort: true, proxy: { "/api": "http://127.0.0.1:6202" } },
  preview: { host: "127.0.0.1", port: 6201, strictPort: true, proxy: { "/api": "http://127.0.0.1:6202" } },
  plugins: [react(), tailwindcss(), {
    name: "maban-update-worker",
    apply: "build",
    generateBundle(_, bundle) {
      const source = readFileSync(new URL("./scripts/update-worker.js", import.meta.url), "utf8");
      const fingerprint = createHash("sha256").update(source);
      for (const name of Object.keys(bundle).sort()) {
        const item = bundle[name];
        fingerprint.update(name).update(item.type === "chunk" ? item.code : item.source);
      }
      this.emitFile({ type: "asset", fileName: "sw.js", source: `// Build: ${fingerprint.digest("hex")}\n${source}` });
    },
  }],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: {
    __APP_VERSION__: JSON.stringify(
      readFileSync(new URL("./VERSION", import.meta.url), "utf8").trim(),
    ),
  },
});
