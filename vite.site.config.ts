import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("./site.html", import.meta.url));
const outDir = fileURLToPath(new URL("./dist-site", import.meta.url));

/**
 * GitHub Pages 的入口必须是 index.html。
 * 源文件叫 site.html（和编辑端区分开），构建后改名。
 */
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "site-entry-as-index",
      closeBundle() {
        const from = `${outDir}/site.html`;
        const to = `${outDir}/index.html`;
        if (existsSync(from)) renameSync(from, to);
      }
    }
  ],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: entry }
  }
});
