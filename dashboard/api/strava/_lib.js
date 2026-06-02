// Shared helpers for the Strava serverless functions (Vercel, Node runtime).
// These run server-side only and read non-public env vars from process.env.
import { createClient } from '@supabase/supabase-js'

export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
export const STRAVA_API = 'https://www.strava.com/api/v3'

// Service-role client — bypasses RLS so the functions can read/write tokens
// and upsert activities on the user's behalf. Never expose this key client-side.
export function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Validate a Supabase access token (JWT) and return the user, or null.
export async function userFromJwt(admin, jwt) {
  if (!jwt) return null
  const { data, error } = await admin.auth.getUser(jwt)
  if (error) return null
  return data?.user ?? null
}

// Pull the bearer token out of an Authorization header.
export function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

// Exchange a refresh token for a fresh access token when the current one is
// expired (or about to be). Returns the updated token fields, persisted.
export async function ensureFreshToken(admin, account) {
  const expiresMs = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0
  // Refresh if it expires within the next 2 minutes.
  if (expiresMs - Date.now() > 120_000) return account

  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    }),
  })
  if (!resp.ok) throw new Error(`Strava token refresh failed (${resp.status})`)
  const t = await resp.json()
  const patch = {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    token_expires_at: new Date(t.expires_at * 1000).toISOString(),
  }
  await admin.from('strava_accounts').update(patch).eq('user_id', account.user_id)
  return { ...account, ...patch }
}
