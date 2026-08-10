import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default {
  root,
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
