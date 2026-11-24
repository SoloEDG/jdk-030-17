import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // 直接用相对路径：new URL().pathname 会对含中文的目录名做百分号编码，导致别名失效。
  resolve: { alias: { "@": "/src" } },
});
