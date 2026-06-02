// POST /api/strava/disconnect — revoke Strava access and remove stored tokens.
import { adminClient, userFromJwt, bearer } from './_lib.js'

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
      .from('strava_accounts').select('access_token').eq('user_id', user.id).maybeSingle()

    // Best-effort revoke on Strava's side; ignore failures.
    if (account?.access_token) {
      try {
        await fetch('https://www.strava.com/oauth/deauthorize', {
          method: 'POST',
          headers: { Authorization: `Bearer ${account.access_token}` },
        })
      } catch (e) {
        console.error('Strava deauthorize failed (continuing):', e)
      }
    }

    await admin.from('strava_accounts').delete().eq('user_id', user.id)
    await admin.from('strava_activities').delete().eq('user_id', user.id)

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('Strava disconnect error:', e)
    return res.status(500).json({ error: 'Disconnect failed' })
  }
}
