import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
        },
    },
    worker: {
        format: 'es',
    },
    server: {
        port: 8000,
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
});
