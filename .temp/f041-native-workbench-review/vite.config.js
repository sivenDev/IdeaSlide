import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

export default {
  root,
  plugins: [react()],
  server: {
    port: 4176,
    strictPort: true,
  },
  preview: {
    port: 4176,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
};
