/**
 * Bill scanning - runs OCR on a photographed/uploaded bill image and makes a
 * best-effort guess at the total amount and date. Always surfaced to the user
 * as a suggestion to verify, never auto-applied silently.
 *
 * Uses tesseract.js, which downloads its recognition model from a CDN on
 * first use - the only part of this app that isn't fully offline.
 */

export interface ScanResult {
    text: string;
    amount?: number;
    date?: string; // yyyy-mm-dd
}

export async function scanBillImage(file: File): Promise<ScanResult> {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');

    try {
        // Photographed receipts are often low-contrast (glare, uneven lighting,
        // small thermal-printer text) — grayscale + contrast stretching measurably
        // improves Tesseract's accuracy on this kind of image. Falls back to the
        // original file if preprocessing fails for any reason (never blocks the scan).
        const input = await preprocessForOCR(file).catch(() => file);
        const { data } = await worker.recognize(input);
        const text = data.text || '';
        return {
            text,
            amount: extractAmount(text),
            date: extractDate(text),
        };
    } finally {
        await worker.terminate();
    }
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
        img.src = url;
    });
}

/**
 * Grayscale + histogram contrast-stretch, with a mild upscale for small images.
 * Deliberately not a hard black/white threshold — that destroys text sitting
 * under glare or in a shadow, which a photographed receipt very often has.
 */
async function preprocessForOCR(file: File): Promise<Blob> {
    const img = await loadImage(file);
    const scale = Math.min(2, 2000 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const gray = new Uint8ClampedArray(data.length / 4);
    const histogram = new Uint32Array(256);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        gray[j] = g;
        histogram[g]++;
    }

    // Clip to the 2nd/98th percentile instead of raw min/max: a handful of
    // blown-out glare pixels or a dark background corner otherwise dominates
    // a naive min/max stretch and can wash out the actual text.
    const totalPixels = gray.length;
    const lowCut = totalPixels * 0.02;
    const highCut = totalPixels * 0.98;
    let running = 0, lo = 0, hi = 255;
    for (let v = 0; v < 256; v++) {
        running += histogram[v];
        if (running >= lowCut) { lo = v; break; }
    }
    running = 0;
    for (let v = 255; v >= 0; v--) {
        running += histogram[v];
        if (running >= totalPixels - highCut) { hi = v; break; }
    }
    const range = Math.max(1, hi - lo);

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const stretched = Math.min(255, Math.max(0, Math.round(((gray[j] - lo) / range) * 255)));
        data[i] = data[i + 1] = data[i + 2] = stretched;
    }
    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
    });
}

function extractAmount(text: string): number | undefined {
    const lines = text.split('\n');
    const keywordRegex = /(grand\s*total|total\s*amount|net\s*amount|amount\s*due|balance\s*due|you\s*pay|^total)/i;
    const numberRegex = /[₹$]?\s*([\d,]+\.\d{2}|[\d,]{2,})/;

    for (const line of lines) {
        if (keywordRegex.test(line)) {
            const match = line.match(numberRegex);
            if (match) {
                const val = parseFloat(match[1].replace(/,/g, ''));
                if (!isNaN(val) && val > 0) return val;
            }
        }
    }

    // Fallback: the largest decimal-looking amount anywhere in the text
    // (the bill total is almost always the biggest line-item-shaped number)
    const allMatches = Array.from(text.matchAll(/[\d,]+\.\d{2}/g))
        .map(m => parseFloat(m[0].replace(/,/g, '')))
        .filter(n => !isNaN(n) && n > 0);

    if (allMatches.length > 0) {
        return Math.max(...allMatches);
    }

    return undefined;
}

/**
 * Validate and format y/m/d as an ISO date string WITHOUT going through the
 * Date constructor's local-timezone interpretation + toISOString() UTC
 * conversion, which shifts the date by a day in positive-UTC-offset zones
 * (e.g. IST) whenever local midnight converts to the previous UTC day.
 */
function toISODateString(y: number, m: number, d: number): string | undefined {
    if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
    // Still validate it's a real calendar date (e.g. rejects 31/02)
    const check = new Date(y, m - 1, d);
    if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return undefined;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}`;
}

function extractDate(text: string): string | undefined {
    // DD/MM/YYYY, DD-MM-YYYY, or DD MM YYYY (also accepts 2-digit years) — the
    // space-separated form is common on thermal-printer receipts and bus/train tickets.
    const dmy = text.match(/\b(\d{1,2})[\/\-\s](\d{1,2})[\/\-\s](\d{2,4})\b/);
    if (dmy) {
        const [, d, m, yRaw] = dmy;
        const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
        const iso = toISODateString(Number(y), Number(m), Number(d));
        if (iso) return iso;
    }

    // YYYY-MM-DD
    const ymd = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (ymd) {
        const [, y, m, d] = ymd;
        const iso = toISODateString(Number(y), Number(m), Number(d));
        if (iso) return iso;
    }

    return undefined;
}
