/**
 * Supabase REST API helpers — no npm package needed.
 *
 * Env vars (set in .env.local + Vercel dashboard):
 *   VITE_SUPABASE_URL      e.g. https://xyzxyz.supabase.co
 *   VITE_SUPABASE_ANON_KEY e.g. eyJhbGci...
 *
 * SQL to run once in Supabase SQL editor:
 *
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
 * Returns true on success, false on error / not configured.
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
