import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Runner de pruebas unitarias (Fase A1).
// - environment node por defecto: los stores son lógica pura.
// - alias @ -> ./src para respetar tsconfig paths.
// - Extensión .mts para que Vite lo cargue como ESM sin warnings.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/store/**/*.ts', 'src/lib/**/*.ts'],
    },
  },
});
