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
            output: {
                // Splits large, rarely-changing third-party libraries into their
                // own cacheable chunks instead of one ~750KB main bundle — keeps
                // each chunk under Vite's 500KB warning threshold and means a
                // change to app code doesn't invalidate the vendor cache.
                manualChunks: {
                    supabase: ['@supabase/supabase-js'],
                    charts: ['chart.js'],
                    'date-utils': ['date-fns'],
                    qrcode: ['qrcode'],
                },
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
