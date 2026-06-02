// GET /api/strava/callback — Strava's OAuth redirect target.
// Exchanges the auth code (+ secret) for tokens server-side and stores them,
// then bounces the user back into the app. The code never touches the browser.
import { adminClient, userFromJwt, STRAVA_TOKEN_URL } from './_lib.js'

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query || {}
  const origin = `https://${req.headers.host}`

  if (oauthError) {
    return res.redirect(302, `/activities?strava=denied`)
  }
  if (!code || !state) {
    return res.redirect(302, `/activities?strava=error`)
  }

  try {
    const admin = adminClient()
    // `state` is the user's Supabase access token — validate it to get the user.
    const user = await userFromJwt(admin, state)
    if (!user) return res.redirect(302, `/activities?strava=error`)

    const resp = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    if (!resp.ok) {
      console.error('Strava code exchange failed:', resp.status, await resp.text())
      return res.redirect(302, `/activities?strava=error`)
    }
    const t = await resp.json()
    const athlete = t.athlete || {}

    const { error } = await admin.from('strava_accounts').upsert({
      user_id: user.id,
      strava_athlete_id: athlete.id ?? null,
      athlete_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || null,
      athlete_avatar: athlete.profile_medium || athlete.profile || null,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      token_expires_at: new Date(t.expires_at * 1000).toISOString(),
      scope: typeof req.query.scope === 'string' ? req.query.scope : null,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) {
      console.error('strava_accounts upsert failed:', error)
      return res.redirect(302, `/activities?strava=error`)
    }

    return res.redirect(302, `/activities?strava=connected`)
  } catch (e) {
    console.error('Strava callback error:', e)
    return res.redirect(302, `${origin}/activities?strava=error`)
  }
}
