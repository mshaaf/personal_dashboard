# DASH. — Personal Dashboard

A single-user life tracking OS. React + Vite + Supabase + Vercel.

## Modules
- **Home** — Day progress ring, checklist, finance pulse, module tiles
- **Calendar** — Google Calendar OAuth integration, month grid
- **Finance** — Weekly income checks, subscriptions, expenses, 12-week chart
- **Gym** — PPL quick-select, set logging, PR detection, 1RM trend, cardio
- **Supplements** — Daily stack with streaks, grouped by time of day
- **Bevel** — Sleep / Recovery / HRV manual entry + trends
- **Reading** — Google Books API, reading log, ETA
- **Goals (12WY)** — Sprint setup, goal projects, lead + lag measures, weekly scorecard
- **Side Projects** — Milestones, status tracking, links

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → run `supabase/schema.sql` (creates all tables + RLS)
3. Run `supabase/seed.sql` (adds your PPL exercises as global entries)
4. Go to **Authentication → Providers** → enable Email (magic link works great for single-user)
5. Copy your **Project URL** and **anon key** from Settings → API

### 3. Configure environment variables
```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 4. Set up Google Calendar (optional)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Calendar API**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized JavaScript origins: `http://localhost:5173` and your production URL
7. Copy the client ID to `.env` as `VITE_GOOGLE_CLIENT_ID`

### 5. Run locally
```bash
npm run dev
# → http://localhost:5173
```

### 6. First login
- Go to your Supabase project → **Authentication → Users → Invite user**
- Use your email address — you'll get a magic link
- Or enable **Magic Link** in Auth settings and add a login page

### 7. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Add env vars in Vercel dashboard:
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_CLIENT_ID
```

---

## Tech Stack
- **React 18** + **Vite**
- **React Router v6** — client-side routing
- **Supabase** — Postgres + Auth + RLS
- **React Query** — data fetching + caching
- **Recharts** — area/line charts
- **Lucide React** — icons
- **Tailwind CSS** — styling
- **date-fns** — date utilities
- **Google Calendar API** — gapi + GIS OAuth

## Gym Quick-Select Logic
The PPL split alternates week-over-week — you don't do Push every Monday. Instead:
- Four big buttons at the top of the Gym page: **Push / Pull / Legs / Cardio**
- Tap whichever session you're on today
- The app creates a workout session for today tagged with that split
- Your exercises load from the seeded PPL list for that split type
- You can always add exercises from the 800+ exercise DB

## Color Scheme
```
Background:  #0a0a0a
Surface:     #141414
Accent:      #dc2626 (crimson)
Success:     #16a34a
Warning:     #ca8a04
```

## Fonts
- **Inter** — UI text
- **JetBrains Mono** — numbers, stats, logs
