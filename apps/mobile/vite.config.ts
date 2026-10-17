import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
	plugins: [react()],
	server: { host: "0.0.0.0", port: 5176, fs: { allow: [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("../../node_modules", import.meta.url))] } },
	build: { target: "es2022", outDir: "dist" },
});
