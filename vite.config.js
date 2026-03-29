import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lock: resolve(__dirname, 'lock.html'),
        add: resolve(__dirname, 'add.html'),
        sync: resolve(__dirname, 'sync.html'),
        generator: resolve(__dirname, 'generator.html'),
        details: resolve(__dirname, 'details.html'),
      },
    },
  },
});
