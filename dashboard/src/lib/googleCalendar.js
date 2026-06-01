// Google Calendar API integration
// Requires VITE_GOOGLE_CLIENT_ID in .env

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'

const TOKEN_KEY = 'gapi_token'
const TOKEN_EXP_KEY = 'gapi_token_expires_at'

let gapiLoaded = false
let tokenClient = null
let onTokenCallback = null

// Load GAPI
export function loadGapi() {
  return new Promise((resolve) => {
    if (gapiLoaded) return resolve()
    window.gapi.load('client', async () => {
      await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] })
      gapiLoaded = true
      resolve()
    })
  })
}

// Init GIS token client — must be called before requestToken / tryRestoreToken
export function initTokenClient(callback) {
  if (!CLIENT_ID) {
    console.warn('Missing VITE_GOOGLE_CLIENT_ID — Google Calendar disabled')
    return
  }
  onTokenCallback = callback
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error('Google auth error:', resp.error)
        return
      }
      // Persist token so we survive page refreshes
      const expiresAt = Date.now() + resp.expires_in * 1000
      localStorage.setItem(TOKEN_KEY, JSON.stringify(resp))
      localStorage.setItem(TOKEN_EXP_KEY, expiresAt.toString())
      window.gapi.client.setToken(resp)
      onTokenCallback?.(resp)
    },
  })
  return tokenClient
}

// Request auth token
export function requestToken() {
  if (!tokenClient) return
  
  // NEW: Look for an unexpired saved token in localStorage
  const savedToken = localStorage.getItem('gapi_token')
  const expiresAt = localStorage.getItem('gapi_token_expires_at')
  const now = new Date().getTime()

  // NEW: If found and valid, bypass login and restore session silently
  if (savedToken && expiresAt && now < parseInt(expiresAt)) {
    const parsedToken = JSON.parse(savedToken)
    window.gapi.client.setToken(parsedToken)
    onTokenCallback?.(parsedToken)
    return 
  }

  if (window.gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' })
  } else {
    tokenClient.requestAccessToken({ prompt: '' })
  }
}

// Sign out — wipes token from memory and localStorage
export function revokeToken() {
  const token = window.gapi.client.getToken()
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token)
    window.gapi.client.setToken(null)
  }
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXP_KEY)
}

export function isSignedIn() {
  return !!window.gapi?.client?.getToken()
}

// Fetch events for a date range. On a 401 (expired token) it triggers a
// silent re-auth; the onTokenCallback then re-runs the fetch.
export async function fetchEvents(timeMin, timeMax) {
  try {
    const resp = await window.gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    })
    return resp.result.items || []
  } catch (err) {
    console.error('Calendar fetch error:', err)
    if (err?.status === 401) {
      // Token expired/invalid — clear it and try a silent refresh.
      window.gapi.client.setToken(null)
      requestTokenSilent()
    }
    throw err
  }
}

export async function fetchMonth(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)
  return fetchEvents(start, end)
}

export function formatEventTime(event) {
  if (event.start.date) return 'All day'
  const start = new Date(event.start.dateTime)
  return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
