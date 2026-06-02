# Personal Dashboard — Build Spec

A private, multi-page tracking dashboard for one user (you). Used on phone and laptop, synced via Supabase. Not a public app.

---

## Tech stack

- **Frontend:** React + Vite
- **Hosting:** Vercel
- **Backend / DB:** Supabase (Postgres + Auth + Row-Level Security)
- **Data fetching:** TanStack Query (React Query) for cache + offline feel
- **Charts:** Recharts
- **Routing:** React Router
- **Forms:** React Hook Form + Zod
- **Styling:** Tailwind (same as Fossil Atlas)
- **Auth:** Supabase magic link, single user, no signup flow exposed

---

## Design system

- **Background:** `#0a0a0a` (near-black)
- **Surface (cards):** `#141414`
- **Border / dividers:** `#262626`
- **Text primary:** `#f5f5f5`
- **Text muted:** `#a3a3a3`
- **Accent (crimson):** `#dc2626`
- **Accent hover / focus:** `#ef4444`
- **Success / green:** `#16a34a` (used only for finance "in the green")
- **Warning / red:** `#dc2626` (finance "in the red", PR badges, active states)
- **Fonts:** Inter for UI, JetBrains Mono for numbers/stats
- **Corner radius:** 12px on cards, 8px on inputs
- **Iconography:** Lucide

---

## App shell

- Sidebar nav on desktop, bottom tab bar on mobile (<768px)
- Routes:
  - `/` — Home summary
  - `/finance`
  - `/gym`
  - `/supplements`
  - `/bevel`
  - `/reading`
  - `/goals` (12 Week Year)
  - `/projects` (side projects)
- Global `useToday()` hook for current date/time
- Global `useUser()` hook (always returns you)
- Toast system for confirmations

---

## Home (`/`)

Summary tiles, clickable to deep-dive into each module.

| Tile | Content |
|---|---|
| Day Progress Ring | Crimson ring around clock; % of 24h elapsed; current time |
| Today's Checklist | Merged list: 12WY lead measures due today + one-off daily to-dos. Checkboxes. |
| Finance Pulse | Month-to-date net (income − subs − expenses) as red/green bar with delta |
| Today's Workout | Today's planned session from split, or "Rest day". Quick-log button. |
| Supplements | Today's supplement checklist with checkmarks |
| Reading | Current book cover + today's pages/minutes + total progress |
| Bevel Snapshot | Sleep score, Recovery, HRV — latest entry |
| Active Sprint | Days remaining in current 12-week sprint + week-over-week lead measure % |

Home is the landing page. Tiles are read-only previews — full interaction lives in each module page.

---

## Module: Finance (`/finance`)

Tabs: **Income**, **Subscriptions**, **Expenses**, **Overview**.

### Income
- Per-check entry: date, amount, hours worked (optional), tips (optional), notes
- Variable weekly — no fixed amount
- Rolling 4-week average displayed
- Expected vs actual chart

### Subscriptions
- name, monthly amount, billing day, category, active toggle, next charge date
- Auto-computed annual cost
- Total monthly subs displayed prominently

### Expenses
- Transaction log: date, amount, category, note
- Categories: groceries, dining, transport, entertainment, shopping, bills, health, other (editable)
- Filterable by month and category

### Overview
- Headline bar: month-to-date `(income − subs − expenses)` — red if negative, green if positive
- Weekly cash flow view (since you're paid weekly)
- Category breakdown pie chart
- Spending trend line (last 12 weeks)

---

## Module: Gym (`/gym`)

### Split
6-day or 3-day PPL (configurable in settings). Default rotation:
- Mon: Push
- Tue: Pull
- Wed: Legs
- Thu: Push
- Fri: Pull
- Sat: Legs
- Sun: Rest

### Default exercises (seeded on first run)

**Push:** Incline Dumbbell Press · Bench Press · Weighted Dips · Overhead Shoulder Press · Cable Lateral Raise · Cable Overhead Tricep Extension · Tricep Rope Pushdown

**Pull:** Pull-Ups · Lat Pulldown · Dumbbell Row · Archer Rear Delt Cable · Cable Hammer Curl · Reverse Barbell Curl · Dumbbell Kelso Shrug

**Legs:** Dumbbell Split Squat · Squat · Sissy Squat · Seated Leg Curl

### Exercise database
Seed from **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** — ~870 exercises with name, equipment, primary/secondary muscles, instructions, images.

Import flow:
1. On first deploy, fetch `dist/exercises.json` from the repo
2. Insert into `exercises` table with `source = 'free-exercise-db'`
3. Mark your default PPL exercises as `is_favorite = true`
4. "Add Exercise" UI lets you search the full DB, tag favorites, or create custom ones

### Logging UI
- Tap today's workout from home → see exercise list for that day
- For each exercise: previous session shown ("last: 185×8, 185×8, 175×7"), input rows for today's sets
- Per-set: weight, reps, RPE (optional)
- "vs last week" delta auto-shown
- PR badge (crimson) when you beat your top set weight × reps
- Add exercise mid-session: search DB → add to today's session
- Mark workout complete

### Progression view
- Per-exercise: line chart of top set, estimated 1RM (Epley formula), and volume across weeks
- All-time PRs list
- Weekly volume summary per muscle group

### Cardio
Separate tab in `/gym`. Manual cardio sessions:
- type (run, bike, row, incline walk, stairs, swim, other)
- duration (min)
- distance (optional)
- avg HR (optional)
- calories (optional)
- notes
- Weekly cardio minutes summary on home + gym page

---

## Module: Supplements (`/supplements`)

### Stack management
List of supplements with: name, dose, unit (mg/g/IU/etc.), time-of-day (AM / midday / PM / pre-bed), notes, active toggle.

### Daily checklist
- Auto-generated each day from active supplements
- Grouped by time-of-day
- Tap to check off — timestamps the log entry
- Streak counter per supplement (consecutive days logged)
- 30-day adherence % per supplement

---

## Module: Bevel data (`/bevel`)

Manual daily entry only. Fields:
- Date
- Sleep score (0–100)
- Recovery (0–100)
- HRV (ms)

Charts:
- 7-day, 30-day, 90-day line charts for each metric
- Recovery color-coded (green ≥66, yellow 34–65, red ≤33)
- Today's snapshot at top

Quick-add: tap "+ Today" → modal with three fields → save.

---

## Module: Reading (`/reading`)

### Add book
- Search by title → query **Google Books API** (`https://www.googleapis.com/books/v1/volumes?q={title}`)
- Show 3–5 top matches with cover, author, page count
- User picks one → saves to `books` table with `title`, `author`, `total_pages`, `cover_url`, `isbn`, `started_at`, `status`
- Manual override for page count if needed
- Status: reading / finished / paused / abandoned

### Daily log
- For current book: input pages read today + minutes read today
- Updates `current_page` on the book
- Progress bar: `current_page / total_pages`
- ETA: `(total_pages − current_page) / 7-day-avg-pages-per-day`

### History
- All books with status
- Weekly pages/minutes totals
- Reading streak

---

## Module: Goals — 12 Week Year (`/goals`)

### Sprint
A 12-week container with manual `start_date` and `end_date`. Only one active sprint at a time (but archive of past sprints viewable).

### Inside a sprint: Projects
A *project* in 12WY terminology = a goal. Each project has:

**Lag measures** (outcomes):
- name, target value, current value, unit
- Examples: "CCNA passed" (boolean), "Body weight 185 lean" (number), "Bench 1RM 275" (number)
- Manual updates plotted over the 12 weeks

**Lead measures** (controllable actions):
- name, cadence (daily / weekly), target count per period
- Examples: "Study 60 min" (daily, 7/wk), "30 practice questions" (daily, 5/wk), "Take practice test" (weekly, 1/wk)
- Lead measures auto-populate the home checklist when due
- Each completion logged with timestamp

### Weekly scorecard
- For current week: `completed leads / scheduled leads = X%`
- Target: ≥85% (12WY benchmark)
- Color: green ≥85, yellow 70–84, red <70
- 12-week history of weekly %

### Sprint review
- At sprint end, archive view with lag measure deltas + average lead %

---

## Module: Projects — Side projects (`/projects`)

Separate from 12WY. For things like Fossil Atlas, laser cutting builds, this dashboard itself.

Each side project:
- name, description, status (active / paused / shipped / abandoned)
- start_date, optional target_date
- links (GitHub, deployed URL, design files)
- milestones (name, done bool, optional date)
- notes (markdown)

List view sortable by status and recency. No lead/lag structure here — just tracking.

---

## Daily To-Do

Lives on home, not a separate page. One-off tasks for today.
- Add task → shows in today's checklist alongside lead measures
- Roll over uncompleted to next day (optional toggle)

---

## Database schema

```sql
-- Single-user app, but RLS-ready
create table profiles (
  id uuid primary key references auth.users,
  display_name text,
  settings jsonb default '{}'::jsonb
);

-- FINANCE
create table income_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  check_date date not null,
  amount numeric(10,2) not null,
  hours numeric(5,2),
  tips numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  name text not null,
  amount numeric(10,2) not null,
  billing_day int check (billing_day between 1 and 31),
  category text,
  active boolean default true,
  created_at timestamptz default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  expense_date date not null,
  amount numeric(10,2) not null,
  category text,
  note text,
  created_at timestamptz default now()
);

-- GYM
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles, -- null for global DB entries
  name text not null,
  category text, -- strength, cardio, stretching, etc.
  equipment text,
  primary_muscles text[],
  secondary_muscles text[],
  instructions text[],
  source text default 'custom', -- 'free-exercise-db' or 'custom'
  is_favorite boolean default false,
  created_at timestamptz default now()
);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  session_date date not null,
  split_day text, -- 'push' | 'pull' | 'legs' | 'cardio' | 'custom'
  notes text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions on delete cascade not null,
  exercise_id uuid references exercises not null,
  set_number int not null,
  weight numeric(6,2),
  reps int,
  rpe numeric(3,1),
  created_at timestamptz default now()
);

create table cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  session_date date not null,
  cardio_type text not null, -- run, bike, row, incline walk, etc.
  duration_min numeric(6,2) not null,
  distance numeric(6,2),
  distance_unit text default 'mi',
  avg_hr int,
  calories int,
  notes text,
  created_at timestamptz default now()
);

-- SUPPLEMENTS
create table supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  name text not null,
  dose numeric(8,2),
  unit text, -- mg, g, IU, mcg, ml
  time_of_day text, -- am, midday, pm, pre-bed
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  supplement_id uuid references supplements not null,
  log_date date not null,
  taken_at timestamptz default now(),
  unique (supplement_id, log_date)
);

-- BEVEL
create table bevel_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  entry_date date not null unique,
  sleep_score int check (sleep_score between 0 and 100),
  recovery int check (recovery between 0 and 100),
  hrv numeric(5,1),
  notes text,
  created_at timestamptz default now()
);

-- READING
create table books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  title text not null,
  author text,
  total_pages int,
  current_page int default 0,
  cover_url text,
  isbn text,
  google_books_id text,
  status text default 'reading', -- reading | finished | paused | abandoned
  started_at date,
  finished_at date,
  created_at timestamptz default now()
);

create table reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  book_id uuid references books not null,
  session_date date not null,
  pages_read int not null,
  minutes_read int,
  created_at timestamptz default now()
);

-- 12 WEEK YEAR
create table sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  name text,
  start_date date not null,
  end_date date not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table goal_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  sprint_id uuid references sprints not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

create table lag_measures (
  id uuid primary key default gen_random_uuid(),
  goal_project_id uuid references goal_projects on delete cascade not null,
  name text not null,
  target_value numeric(12,2),
  current_value numeric(12,2),
  unit text,
  is_boolean boolean default false,
  done boolean default false,
  created_at timestamptz default now()
);

create table lag_measure_logs (
  id uuid primary key default gen_random_uuid(),
  lag_measure_id uuid references lag_measures on delete cascade not null,
  log_date date not null,
  value numeric(12,2),
  note text,
  created_at timestamptz default now()
);

create table lead_measures (
  id uuid primary key default gen_random_uuid(),
  goal_project_id uuid references goal_projects on delete cascade not null,
  name text not null,
  cadence text not null, -- 'daily' | 'weekly'
  target_per_period int default 1,
  active boolean default true,
  created_at timestamptz default now()
);

create table lead_measure_logs (
  id uuid primary key default gen_random_uuid(),
  lead_measure_id uuid references lead_measures on delete cascade not null,
  log_date date not null,
  completed boolean default true,
  created_at timestamptz default now()
);

-- SIDE PROJECTS
create table side_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  name text not null,
  description text,
  status text default 'active', -- active | paused | shipped | abandoned
  start_date date,
  target_date date,
  links jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now()
);

create table side_project_milestones (
  id uuid primary key default gen_random_uuid(),
  side_project_id uuid references side_projects on delete cascade not null,
  name text not null,
  done boolean default false,
  done_at date,
  created_at timestamptz default now()
);

-- DAILY TO-DOS
create table daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  task_date date not null,
  text text not null,
  done boolean default false,
  rollover boolean default false,
  created_at timestamptz default now()
);
```

RLS: every table has `user_id = auth.uid()` policy. Exercises table allows reads of `user_id IS NULL` (global DB) plus own entries.

---

## External integrations

| Service | Purpose | Auth | Cost |
|---|---|---|---|
| Google Books API | Book metadata + page count | None for read | Free, ~1000 req/day |
| free-exercise-db | Seed exercise database | None (static JSON) | Free |
| Supabase | DB + Auth + sync | Anon key + RLS | Free tier sufficient |
| Vercel | Hosting | Project token | Free tier sufficient |

---

## Build order

1. **Project scaffold** — Vite + React + Tailwind + Router + Supabase client + theme tokens
2. **Auth + schema** — Supabase project, run all migrations, magic-link auth, profile row
3. **App shell** — sidebar/bottom-tab nav, layout, home skeleton with empty tiles
4. **Day Progress Ring** — first piece of real UI, validates the design language
5. **Finance** — full module (income, subs, expenses, overview)
6. **12WY Goals** — sprints, projects, lead/lag measures (drives the home checklist)
7. **Daily To-Do** — completes the home checklist
8. **Gym** — exercise DB seed from free-exercise-db, sessions, sets, progression charts, cardio
9. **Supplements** — stack + daily checklist + streaks
10. **Reading** — Google Books integration, books, reading sessions
11. **Bevel** — daily entry, charts
12. **Side Projects** — projects + milestones
13. **Home polish** — wire all tiles to live data, animations, mobile pass
14. **Mobile pass** — bottom tab bar, touch targets, swipe gestures where useful
15. **Deploy** — Vercel + Supabase production keys

---

## Out of scope (explicit)

- Public user accounts / signup flow
- Sharing / collaboration / social features
- API for third parties
- Mobile native app (it's a responsive web app)
- Auto-import from Apple Health / Whoop / Bevel / wearables (manual only)
- Notifications / push (browser tab is enough)
- Payment / billing
- Admin dashboard
