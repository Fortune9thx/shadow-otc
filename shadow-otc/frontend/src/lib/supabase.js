/**
 * Supabase REST API helpers — no npm package needed.
 *
 * Env vars (set in .env.local + Vercel dashboard):
 *   VITE_SUPABASE_URL      e.g. https://xyzxyz.supabase.co
 *   VITE_SUPABASE_ANON_KEY e.g. eyJhbGci...
 *
 * ── Run once in Supabase SQL editor ──────────────────────────────────────
 *
 *   -- Marketplace deals
 *   CREATE TABLE IF NOT EXISTS deals (
 *     id           text PRIMARY KEY,
 *     wallet_address text,
 *     created_at   bigint DEFAULT EXTRACT(EPOCH FROM now())::bigint * 1000,
 *     deal         jsonb NOT NULL
 *   );
 *   ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read"   ON deals FOR SELECT USING (true);
 *   CREATE POLICY "public insert" ON deals FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "public update" ON deals FOR UPDATE USING (true);
 *
 *   -- Private OTC rooms
 *   CREATE TABLE IF NOT EXISTS rooms (
 *     room_id      text PRIMARY KEY,
 *     buyer_wallet text,
 *     deal         jsonb,
 *     deal_id      text,
 *     status       text DEFAULT 'open',
 *     updated_at   bigint DEFAULT EXTRACT(EPOCH FROM now())::bigint * 1000
 *   );
 *   ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read"   ON rooms FOR SELECT USING (true);
 *   CREATE POLICY "public insert" ON rooms FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "public update" ON rooms FOR UPDATE USING (true);
 *
 *   -- Room chat messages
 *   CREATE TABLE IF NOT EXISTS room_messages (
 *     id       bigserial PRIMARY KEY,
 *     room_id  text NOT NULL,
 *     wallet   text,
 *     text     text NOT NULL,
 *     ts       bigint DEFAULT EXTRACT(EPOCH FROM now())::bigint * 1000
 *   );
 *   ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read"   ON room_messages FOR SELECT USING (true);
 *   CREATE POLICY "public insert" ON room_messages FOR INSERT WITH CHECK (true);
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const headers = () => ({
  apikey:        SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
});

/**
 * Fetch all deals from Supabase.
 * Returns array of deal objects, or null on error / not configured.
 */
export async function sbGetDeals() {
  if (!supabaseConfigured) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/deals?select=deal&order=created_at.desc`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(r => r.deal).filter(Boolean) : null;
  } catch {
    return null;
  }
}

/**
 * Upsert a single deal into Supabase (insert or update by id).
 */
export async function sbUpsertDeal(deal) {
  if (!supabaseConfigured) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/deals`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        id:             String(deal.id),
        wallet_address: deal.walletAddress ?? null,
        created_at:     deal.createdAt ?? Date.now(),
        deal,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════
   PRIVATE DEAL ROOMS
   Always-on persistent storage — no Render sleep issues.
   Falls back to the Render backend when not configured.
═══════════════════════════════════════════════════ */

/**
 * Get room state + messages from Supabase.
 * Returns { exists, buyerWallet, deal, dealId, status, messages } or null.
 */
export async function sbGetRoom(roomId) {
  if (!supabaseConfigured) return null;
  try {
    const [roomRes, msgRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rooms?room_id=eq.${encodeURIComponent(roomId)}&select=*`,
        { headers: headers() }),
      fetch(`${SUPABASE_URL}/rest/v1/room_messages?room_id=eq.${encodeURIComponent(roomId)}&order=ts.asc&limit=200`,
        { headers: headers() }),
    ]);
    if (!roomRes.ok) return null;
    const rooms    = await roomRes.json();
    const messages = msgRes.ok ? await msgRes.json() : [];
    const row      = Array.isArray(rooms) ? rooms[0] : null;
    return {
      exists:      Boolean(row),
      buyerWallet: row?.buyer_wallet  ?? null,
      deal:        row?.deal          ?? null,
      dealId:      row?.deal_id       ?? null,
      status:      row?.status        ?? "open",
      messages:    Array.isArray(messages)
        ? messages.map(m => ({ wallet: m.wallet, text: m.text, ts: m.ts }))
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Create or update a room (upsert by room_id).
 * Pass only the fields you want to change.
 */
export async function sbUpsertRoom(roomId, { buyerWallet, deal, dealId, status } = {}) {
  if (!supabaseConfigured) return false;
  try {
    const payload = {
      room_id:    roomId,
      updated_at: Date.now(),
      ...(buyerWallet !== undefined && { buyer_wallet: buyerWallet }),
      ...(deal        !== undefined && { deal }),
      ...(dealId      !== undefined && { deal_id: String(dealId) }),
      ...(status      !== undefined && { status }),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rooms`, {
      method:  "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
      body:    JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Append a chat message to a room.
 */
export async function sbAddMessage(roomId, wallet, text) {
  if (!supabaseConfigured) return false;
  if (!text?.trim()) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/room_messages`, {
      method:  "POST",
      headers: headers(),
      body:    JSON.stringify({ room_id: roomId, wallet, text: text.trim(), ts: Date.now() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
