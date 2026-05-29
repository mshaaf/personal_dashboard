// Google Calendar API integration
// Requires VITE_GOOGLE_CLIENT_ID in .env

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'

let gapiLoaded = false
let gisLoaded = false
let tokenClient = null
let onTokenCallback = null

// Load GAPI
export function loadGapi() {
  return new Promise((resolve) => {
    if (gapiLoaded) return resolve()
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
      })
      gapiLoaded = true
      resolve()
    })
  })
}

// Load GIS token client
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

      const now = new Date().getTime()
      const expiresAt = now + (resp.expires_in * 1000)
      localStorage.setItem('gapi_token', JSON.stringify(resp))
      localStorage.setItem('gapi_token_expires_at', expiresAt.toString())

      // NEW: Activate the token inside Google's client immediately
      window.gapi.client.setToken(resp)
      onTokenCallback?.(resp)
    },
  })
  gisLoaded = true
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


// Sign out
export function revokeToken() {
  const token = window.gapi.client.getToken()
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token)
    window.gapi.client.setToken(null)
  }
  // NEW: Wipe saved data so a new user can log in cleanly
  localStorage.removeItem('gapi_token')
  localStorage.removeItem('gapi_token_expires_at')
}


export function isSignedIn() {
  return !!window.gapi?.client?.getToken()
}

// Fetch events for a date range
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
    return []
  }
}

// Fetch upcoming events (next 7 days)
export async function fetchUpcoming() {
  const now = new Date()
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  return fetchEvents(now, nextWeek)
}

// Fetch events for a specific month
export async function fetchMonth(year, month) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0, 23, 59, 59)
  return fetchEvents(start, end)
}

// Format event time
export function formatEventTime(event) {
  if (event.start.date) return 'All day'
  const start = new Date(event.start.dateTime)
  return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
