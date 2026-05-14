const express = require('express');
const cors    = require('cors');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Persistent free store (jsonblob.com — survives Render restarts) ──────────
const BLOB_ID  = '019e256f-683e-7afb-9300-88b4cd288af6';
const BLOB_URL = `https://jsonblob.com/api/jsonBlob/${BLOB_ID}`;

// ── In-memory cache so we don't hit jsonblob on every request ────────────────
let cache      = [];          // array of deal objects
let cacheReady = false;

async function blobFetch(method, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
    };
    const req = https.request(BLOB_URL, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function loadCache() {
  try {
    const data = await blobFetch('GET');
    cache      = Array.isArray(data?.deals) ? data.deals : [];
    cacheReady = true;
    console.log(`✅ Loaded ${cache.length} listings from persistent store`);
  } catch (err) {
    console.error('⚠️  Could not load from blob store:', err.message);
    cache      = [];
    cacheReady = true;
  }
}

async function saveCache() {
  try {
    await blobFetch('PUT', { deals: cache });
  } catch (err) {
    console.error('⚠️  Could not save to blob store:', err.message);
  }
}

// Load immediately on startup
loadCache();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://shadow-otc.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000',
    /\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status:   'ok',
    service:  'Shadow OTC Backend',
    network:  'Ritual Testnet',
    chainId:  1979,
    listings: cache.length,
  });
});

// ── GET /deals — return all stored listings ───────────────────────────────────
app.get('/deals', async (req, res) => {
  if (!cacheReady) await loadCache();
  res.json({ deals: cache, total: cache.length });
});

// ── POST /deals — add or update a listing ────────────────────────────────────
app.post('/deals', async (req, res) => {
  if (!cacheReady) await loadCache();

  const listing = req.body;
  if (!listing || !listing.id) {
    return res.status(400).json({ error: 'listing.id is required' });
  }

  // Upsert by id
  const idx = cache.findIndex(d => String(d.id) === String(listing.id));
  if (idx >= 0) {
    cache[idx] = listing;
  } else {
    cache.unshift(listing);   // newest first
  }

  // Persist asynchronously — don't block the response
  saveCache().catch(() => {});

  res.json({ ok: true, total: cache.length });
});

// ── POST /tweet — auto-tweet new listing (non-fatal) ─────────────────────────
app.post('/tweet', (req, res) => {
  // Twitter bot integration placeholder — non-fatal if not configured
  res.json({ ok: true, note: 'tweet endpoint acknowledged' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Shadow OTC backend running on port ${PORT}`);
});
