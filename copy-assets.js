import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const assets = [
    { from: 'index.html', to: 'dist/index.html' },
    { from: 'manifest.json', to: 'dist/manifest.json' },
    { from: 'public/service-worker.js', to: 'dist/service-worker.js' },
];

// Ensure dist directory exists
if (!existsSync('dist')) {
    mkdirSync('dist', { recursive: true });
}

// Copy SQLite WASM file from node_modules
try {
    const wasmSource = 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm';
    const wasmDest = 'dist/sqlite3.wasm';

    if (existsSync(wasmSource)) {
        copyFileSync(wasmSource, wasmDest);
        console.log('✅ Copied sqlite3.wasm');
    } else {
        console.warn('⚠️  sqlite3.wasm not found - run npm install first');
    }
} catch (err) {
    console.error('Error copying WASM:', err.message);
}

// Copy other assets
assets.forEach(({ from, to }) => {
    try {
        if (existsSync(from)) {
            copyFileSync(from, to);
            console.log(`✅ Copied ${from} → ${to}`);
        }
    } catch (err) {
        console.error(`Error copying ${from}:`, err.message);
    }
});
