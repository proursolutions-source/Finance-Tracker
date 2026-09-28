// Temporary build-time diagnostic: confirms whether Vercel's build step
// actually receives VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in process.env
// before Vite runs. Never prints the actual secret values, only presence/length.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
console.log('[env-check] VITE_SUPABASE_URL present:', !!url, url ? `(length ${url.length})` : '');
console.log('[env-check] VITE_SUPABASE_ANON_KEY present:', !!key, key ? `(length ${key.length})` : '');
console.log('[env-check] VERCEL_ENV:', process.env.VERCEL_ENV || '(not set)');
console.log('[env-check] NODE_ENV:', process.env.NODE_ENV || '(not set)');
