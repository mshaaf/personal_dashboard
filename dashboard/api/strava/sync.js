// POST /api/strava/sync — pulls recent activities from Strava into Supabase.
// Auth: Authorization: Bearer <supabase access token>. All Strava calls and
// token refresh happen here so tokens never reach the browser.
import { adminClient, userFromJwt, bearer, ensureFreshToken, STRAVA_API } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const admin = adminClient()
    const user = await userFromJwt(admin, bearer(req))
    if (!user) return res.status(401).json({ error: 'Not authenticated' })

    const { data: account } = await admin
      .from('strava_accounts').select('*').eq('user_id', user.id).maybeSingle()
    if (!account) return res.status(400).json({ error: 'Strava not connected' })

    const fresh = await ensureFreshToken(admin, account)

    // Only pull activities newer than the last sync (or the last 30 days on
    // first run) to stay well under Strava's rate limits.
    const fallback = Math.floor((Date.now() - 30 * 86400_000) / 1000)
    const after = account.last_sync_at
      ? Math.floor(new Date(account.last_sync_at).getTime() / 1000) - 86400 // 1d overlap
      : fallback

    const url = `${STRAVA_API}/athlete/activities?per_page=100&after=${after}`
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${fresh.access_token}` } })
    if (!resp.ok) {
      console.error('Strava activities fetch failed:', resp.status, await resp.text())
      return res.status(502).json({ error: `Strava fetch failed (${resp.status})` })
    }
    const activities = await resp.json()

    const rows = (Array.isArray(activities) ? activities : []).map(a => ({
      user_id: user.id,
      strava_id: a.id,
      name: a.name ?? null,
      sport_type: a.sport_type || a.type || null,
      start_date: a.start_date_local || a.start_date || null,
      distance_m: a.distance ?? null,
      moving_time_s: a.moving_time ?? null,
      elapsed_time_s: a.elapsed_time ?? null,
      total_elevation_gain_m: a.total_elevation_gain ?? null,
      average_speed: a.average_speed ?? null,
      average_heartrate: a.average_heartrate ?? null,
      max_heartrate: a.max_heartrate ?? null,
      calories: a.calories ?? null,
      map_polyline: a.map?.summary_polyline ?? null,
      raw: a,
    }))

    if (rows.length) {
      const { error } = await admin
        .from('strava_activities').upsert(rows, { onConflict: 'user_id,strava_id' })
      if (error) {
        console.error('strava_activities upsert failed:', error)
        return res.status(500).json({ error: 'Failed to store activities' })
      }
    }

    await admin.from('strava_accounts')
      .update({ last_sync_at: new Date().toISOString() }).eq('user_id', user.id)

    return res.status(200).json({ synced: rows.length })
  } catch (e) {
    console.error('Strava sync error:', e)
    return res.status(500).json({ error: 'Sync failed' })
  }
}
