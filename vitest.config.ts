import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests automáticos (npm test). Cada fichero corre en su propio proceso, con
 * una carpeta de datos temporal (tests/setup.ts): nunca tocan tus datos reales.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // "server-only" solo protege de importar código de servidor en el navegador.
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    pool: "forks",
    testTimeout: 20_000,
  },
});
