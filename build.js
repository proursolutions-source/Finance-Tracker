import * as esbuild from 'esbuild';

// Build main app
await esbuild.build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'dist/app.js',
    format: 'esm',
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
    target: 'es2022',
});

// Build worker separately (workers need to be separate files)
await esbuild.build({
    entryPoints: ['src/worker/db-worker.ts'],
    bundle: true,
    outfile: 'dist/db-worker.js',
    format: 'esm',
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production',
    target: 'es2022',
});

console.log('✅ Build complete: app.js and db-worker.js');
