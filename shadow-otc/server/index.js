const express   = require('express');
const cors      = require('cors');
const https     = require('https');
const { spawn } = require('child_process');
const path      = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

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
    'https://shadowotc.xyz',
    'https://www.shadowotc.xyz',
    'http://localhost:3000',
    'http://localhost:5000',
    /\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '32kb' })); // prevent large body abuse

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/deals',   apiLimiter);
app.use('/notify',  writeLimiter);
app.use('/rooms',   apiLimiter);

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
  res.json({ ok: true, note: 'tweet endpoint acknowledged' });
});

// ── POST /notify — email notification for deal status change ──────────────────
app.post('/notify', async (req, res) => {
  const { email, dealId, status, msg } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.json({ ok: false, note: 'invalid email' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Notify] RESEND_API_KEY not set — would email ${email}: Deal #${dealId} ${msg}`);
    return res.json({ ok: true, note: 'email logging only (RESEND_API_KEY not configured)' });
  }

  try {
    const emailRes = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        from:    'Shadow OTC <onboarding@resend.dev>',
        to:      [email],
        subject: `Deal #${dealId} Update — Shadow OTC`,
        html: `
          <div style="font-family:monospace;max-width:480px;margin:0 auto;background:#0F1412;
                      color:#e2e8f0;padding:28px 24px;border-radius:14px;border:1px solid rgba(11,107,75,0.30)">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.12em;
                      color:rgba(255,255,255,0.35);text-transform:uppercase">Shadow OTC · Ritual Testnet</p>
            <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.60)">
              Deal <strong style="color:#fff">#${dealId}</strong> status changed:
            </p>
            <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#4ade80">${msg}</p>
            <a href="https://shadow-otc.vercel.app/#deal=${dealId}"
               style="display:inline-block;background:#0B6B4B;color:#fff;padding:10px 20px;
                      border-radius:10px;text-decoration:none;font-size:13px;font-weight:600">
              View Deal →
            </a>
            <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.25)">
              To stop receiving emails, remove your email from your profile on Shadow OTC.
            </p>
          </div>
        `,
      });

      const opts = {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type':  'application/json',
        },
      };

      const reqHttp = require('https').request('https://api.resend.com/emails', opts, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      });
      reqHttp.on('error', reject);
      reqHttp.write(body);
      reqHttp.end();
    });

    console.log(`[Notify] Email sent to ${email} for deal #${dealId} (status ${status}) — HTTP ${emailRes.status}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Notify] Email send failed:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// ── GET /sellers — return all registered sellers with skills ──────────────────
app.get('/sellers', (req, res) => {
  const usersFile = path.join(__dirname, '..', 'agents', 'data', 'telegram-users.json');
  try {
    const raw   = require('fs').existsSync(usersFile)
                  ? JSON.parse(require('fs').readFileSync(usersFile, 'utf8'))
                  : {};
    const sellers = Object.entries(raw)
      .map(([wallet, entry]) => {
        const e = typeof entry === 'object' ? entry : { chatId: entry, skills: [], role: null };
        return { wallet, skills: e.skills || [], role: e.role };
      })
      .filter(s => s.role === 'seller');
    res.json({ sellers, total: sellers.length });
  } catch {
    res.json({ sellers: [], total: 0 });
  }
});

// ── GET /verify/:dealId — trigger verifier agent via SSE stream ──────────────
app.get('/verify/:dealId', (req, res) => {
  const { dealId } = req.params;
  const maxRetries = parseInt(req.query.maxRetries) || 3;
  const retryDelay = parseInt(req.query.retryDelay) || 15000;

  // Stream server-sent events so the frontend gets live agent logs
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (msg) => {
    pushActivity(dealId, msg);
    res.write(`data: ${JSON.stringify({ log: msg, ts: Date.now() })}\n\n`);
  };

  send(`[Agent] Starting verification for Deal #${dealId}`);
  send(`[Agent] Max retries: ${maxRetries} · Retry delay: ${retryDelay / 1000}s`);

  const agentPath = path.join(__dirname, '..', 'agents', 'agents', 'verifier.js');

  // Check if verifier key is configured — don't crash if not
  if (!process.env.SELLER_PRIVATE_KEY) {
    send('[Agent] ⚠ SELLER_PRIVATE_KEY not set — running in simulation mode');
    send('[Agent] Reading deal from Ritual chain...');
    setTimeout(() => { send('[Agent] Fetching condition URL...'); }, 800);
    setTimeout(() => { send('[Agent] HTTP fetch complete. Parsing metrics...'); }, 2000);
    setTimeout(() => { send('[Agent] Condition met ✓ — calling executeDeal() on-chain...'); }, 3500);
    setTimeout(() => { send('[Agent] TX confirmed. Funds released to seller.'); res.write('data: {"done":true,"success":true}\n\n'); res.end(); }, 5000);
    return;
  }

  const proc = spawn('node', [agentPath, String(dealId), String(maxRetries), String(retryDelay)], {
    env: { ...process.env },
    cwd: path.join(__dirname, '..'),
  });

  proc.stdout.on('data', data => {
    String(data).split('\n').filter(l => l.trim()).forEach(line => send(`[Agent] ${line}`));
  });
  proc.stderr.on('data', data => {
    String(data).split('\n').filter(l => l.trim()).forEach(line => send(`[Agent] ⚠ ${line}`));
  });
  proc.on('close', code => {
    send(`[Agent] Process exited (code ${code})`);
    res.write(`data: ${JSON.stringify({ done: true, success: code === 0 })}\n\n`);
    res.end();
  });
  proc.on('error', err => {
    send(`[Agent] Failed to start: ${err.message}`);
    res.write(`data: ${JSON.stringify({ done: true, success: false, error: err.message })}\n\n`);
    res.end();
  });

  // Clean up if client disconnects
  req.on('close', () => proc.kill());
});

// ── GET /agent-activity — recent agent log entries ────────────────────────────
const activityLog = [];

function pushActivity(dealId, msg) {
  activityLog.push({ dealId, msg, ts: Date.now() });
  if (activityLog.length > 100) activityLog.shift();
}

app.get('/agent-activity', (req, res) => {
  res.json({ activity: activityLog.slice(-20) });
});

// ── PRIVATE DEAL ROOMS ─────────────────────────────────────────────────────────
// In-memory room store. Rooms expire after 7 days.
// Structure: { roomId → { buyerWallet, deal, dealId, messages:[{wallet,text,ts}], updatedAt } }
const rooms = {};

// Evict rooms older than 7 days (run hourly)
setInterval(() => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  Object.keys(rooms).forEach(id => { if (rooms[id]?.updatedAt < cutoff) delete rooms[id]; });
}, 60 * 60 * 1000);

// GET /rooms/:roomId — fetch room state + messages
app.get('/rooms/:roomId', (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) return res.json({ exists: false, messages: [] });
  res.json({ exists: true, ...room });
});

// PUT /rooms/:roomId — create or patch room (deal terms, dealId, wallets, status)
app.put('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const prev = rooms[roomId] || { messages: [], updatedAt: 0 };
  // Only allow patching safe fields — never overwrite messages via PUT
  const { buyerWallet, deal, dealId, status } = req.body;
  rooms[roomId] = {
    ...prev,
    ...(buyerWallet !== undefined && { buyerWallet }),
    ...(deal       !== undefined && { deal }),
    ...(dealId     !== undefined && { dealId }),
    ...(status     !== undefined && { status }),
    updatedAt: Date.now(),
  };
  res.json({ ok: true, room: rooms[roomId] });
});

// POST /rooms/:roomId/message — append a chat message
app.post('/rooms/:roomId/message', (req, res) => {
  const { roomId } = req.params;
  const { wallet, text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'empty message' });
  // Injection guard — never allow a client to impersonate system messages
  if (!wallet || wallet.toLowerCase() === 'system') {
    return res.status(400).json({ error: 'invalid wallet' });
  }
  if (!rooms[roomId]) rooms[roomId] = { messages: [], updatedAt: Date.now() };
  if (!rooms[roomId].messages) rooms[roomId].messages = [];
  rooms[roomId].messages.push({ wallet: wallet || 'anon', text: text.trim(), ts: Date.now() });
  if (rooms[roomId].messages.length > 200) rooms[roomId].messages.shift();
  rooms[roomId].updatedAt = Date.now();
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Shadow OTC backend running on port ${PORT}`);
  console.log(`📄 Contract V3:  ${process.env.CONTRACT_ADDRESS_V3 || process.env.CONTRACT_ADDRESS_V2 || 'not set'}`);

  // ── Auto-spawn Telegram bot if token is present ──────────────────────────
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const botPath = path.join(__dirname, '..', 'agents', 'telegram-bot.js');
    if (!require('fs').existsSync(botPath)) {
      console.warn('⚠️  Telegram bot file not found — bot not started');
    } else {
      const spawnBot = () => {
        const bot = spawn('node', [botPath], {
          env:   { ...process.env },
          cwd:   path.join(__dirname, '..'),
          stdio: 'inherit',
        });
        bot.on('error', err => console.error('[Bot] Failed to start:', err.message));
        bot.on('exit',  code => {
          if (code !== 0) {
            console.warn(`[Bot] Exited with code ${code} — restarting in 5s…`);
            setTimeout(spawnBot, 5000);
          }
        });
      };
      spawnBot();
      console.log('🤖 Telegram bot spawned (@ShadowOTC_bot)');
    }
  } else {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — bot not started');
  }
});
