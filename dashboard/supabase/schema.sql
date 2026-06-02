-- ============================================
-- PERSONAL DASHBOARD — SUPABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ——————————————————————————————————————
-- PROFILES (single user row)
-- ——————————————————————————————————————
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Auto-create profile on sign up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ——————————————————————————————————————
-- FINANCE
-- ——————————————————————————————————————
create table if not exists income_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  check_date date not null,
  amount numeric(10,2) not null,
  hours numeric(5,2),
  tips numeric(10,2),
  notes text,
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  amount numeric(10,2) not null,
  billing_day int check (billing_day between 1 and 31),
  category text default 'other',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  expense_date date not null,
  amount numeric(10,2) not null,
  category text default 'other',
  note text,
  created_at timestamptz default now()
);

-- ——————————————————————————————————————
-- GYM
-- ——————————————————————————————————————
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade, -- null = global DB entry
  name text not null,
  category text,
  equipment text,
  primary_muscles text[],
  secondary_muscles text[],
  instructions text[],
  source text default 'custom', -- 'free-exercise-db' | 'custom'
  is_favorite boolean default false,
  created_at timestamptz default now()
);

-- Allow reading global exercises (user_id is null)
create index if not exists exercises_name_idx on exercises(name);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  session_date date not null,
  split_day text, -- push | pull | legs | cardio | custom
  notes text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, session_date)
);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions(id) on delete cascade not null,
  exercise_id uuid references exercises(id) not null,
  set_number int not null,
  weight numeric(6,2),
  reps int,
  rpe numeric(3,1),
  created_at timestamptz default now(),
  unique(session_id, exercise_id, set_number)
);

create table if not exists cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  session_date date not null,
  cardio_type text not null,
  duration_min numeric(6,2) not null,
  distance numeric(8,2),
  distance_unit text default 'mi',
  avg_hr int,
  calories int,
  notes text,
  created_at timestamptz default now()
);

-- ——————————————————————————————————————
-- SUPPLEMENTS
-- ——————————————————————————————————————
create table if not exists supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  dose numeric(8,2),
  unit text,
  time_of_day text default 'am', -- am | midday | pm | pre-bed
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists supplement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  supplement_id uuid references supplements(id) on delete cascade not null,
  log_date date not null,
  taken_at timestamptz default now(),
  unique(supplement_id, log_date)
);

-- ——————————————————————————————————————
-- BEVEL
-- ——————————————————————————————————————
create table if not exists bevel_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  entry_date date not null,
  sleep_score int check (sleep_score between 0 and 100),
  recovery int check (recovery between 0 and 100),
  hrv numeric(5,1),
  notes text,
  created_at timestamptz default now(),
  unique(user_id, entry_date)
);

-- ——————————————————————————————————————
-- READING
-- ——————————————————————————————————————
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
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

create table if not exists reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  book_id uuid references books(id) on delete cascade not null,
  session_date date not null,
  pages_read int not null,
  minutes_read int,
  created_at timestamptz default now()
);

-- ——————————————————————————————————————
-- 12 WEEK YEAR
-- ——————————————————————————————————————
create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text,
  start_date date not null,
  end_date date not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists goal_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  sprint_id uuid references sprints(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now()
);

create table if not exists lag_measures (
  id uuid primary key default gen_random_uuid(),
  goal_project_id uuid references goal_projects(id) on delete cascade not null,
  name text not null,
  target_value numeric(12,2),
  current_value numeric(12,2),
  unit text,
  is_boolean boolean default false,
  done boolean default false,
  created_at timestamptz default now()
);

create table if not exists lag_measure_logs (
  id uuid primary key default gen_random_uuid(),
  lag_measure_id uuid references lag_measures(id) on delete cascade not null,
  log_date date not null,
  value numeric(12,2),
  note text,
  created_at timestamptz default now()
);

create table if not exists lead_measures (
  id uuid primary key default gen_random_uuid(),
  goal_project_id uuid references goal_projects(id) on delete cascade not null,
  name text not null,
  cadence text not null default 'daily', -- daily | weekly
  target_per_period int default 1,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists lead_measure_logs (
  id uuid primary key default gen_random_uuid(),
  lead_measure_id uuid references lead_measures(id) on delete cascade not null,
  log_date date not null,
  completed boolean default true,
  created_at timestamptz default now(),
  unique(lead_measure_id, log_date)
);

-- ——————————————————————————————————————
-- SIDE PROJECTS
-- ——————————————————————————————————————
create table if not exists side_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'active', -- active | paused | shipped | abandoned
  start_date date,
  target_date date,
  links jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now()
);

create table if not exists side_project_milestones (
  id uuid primary key default gen_random_uuid(),
  side_project_id uuid references side_projects(id) on delete cascade not null,
  name text not null,
  done boolean default false,
  done_at date,
  created_at timestamptz default now()
);

-- ——————————————————————————————————————
-- DAILY TO-DOS
-- ——————————————————————————————————————
create table if not exists daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  task_date date not null,
  text text not null,
  done boolean default false,
  rollover boolean default false,
  created_at timestamptz default now()
);

-- ——————————————————————————————————————
-- STRAVA
-- ——————————————————————————————————————
-- Tokens are written only by the server-side Vercel functions (service role,
-- which bypasses RLS). RLS still scopes every row to its owner.
create table if not exists strava_accounts (
  user_id uuid primary key references profiles(id) on delete cascade,
  strava_athlete_id bigint,
  athlete_name text,
  athlete_avatar text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  last_sync_at timestamptz,
  connected_at timestamptz default now()
);

create table if not exists strava_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  strava_id bigint not null,
  name text,
  sport_type text,                 -- Run | Ride | Swim | ...
  start_date timestamptz,          -- start_date_local
  distance_m numeric,              -- meters (convert to mi in UI)
  moving_time_s int,
  elapsed_time_s int,
  total_elevation_gain_m numeric,
  average_speed numeric,           -- m/s -> pace in UI
  average_heartrate numeric,
  max_heartrate numeric,
  calories numeric,
  map_polyline text,
  raw jsonb,
  created_at timestamptz default now(),
  unique(user_id, strava_id)
);
create index if not exists strava_activities_user_date_idx on strava_activities(user_id, start_date desc);

-- ——————————————————————————————————————
-- ROW LEVEL SECURITY
-- ——————————————————————————————————————
-- Enable RLS on all tables
do $$ 
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute 'alter table public.' || r.tablename || ' enable row level security';
  end loop;
end $$;

-- Helper function
create or replace function is_own_user_id(uid uuid) returns boolean as $$
  select auth.uid() = uid;
$$ language sql security definer;

-- Profiles policy
create policy "users can manage own profile"
  on profiles for all using (auth.uid() = id);

-- All other tables: user can only access their own rows
create policy "user can manage own income" on income_checks for all using (is_own_user_id(user_id));
create policy "user can manage own subs" on subscriptions for all using (is_own_user_id(user_id));
create policy "user can manage own expenses" on expenses for all using (is_own_user_id(user_id));

-- Exercises: own or global (user_id is null)
create policy "user can read global exercises" on exercises for select using (user_id is null or is_own_user_id(user_id));
create policy "user can manage own exercises" on exercises for insert with check (is_own_user_id(user_id));
create policy "user can update own exercises" on exercises for update using (is_own_user_id(user_id));

create policy "user can manage own sessions" on workout_sessions for all using (is_own_user_id(user_id));
create policy "user can manage own sets" on workout_sets for all using (
  exists (select 1 from workout_sessions ws where ws.id = session_id and is_own_user_id(ws.user_id))
);
create policy "user can manage own cardio" on cardio_sessions for all using (is_own_user_id(user_id));

create policy "user can manage own strava account" on strava_accounts for all using (is_own_user_id(user_id));
create policy "user can manage own strava activities" on strava_activities for all using (is_own_user_id(user_id));

create policy "user can manage own supplements" on supplements for all using (is_own_user_id(user_id));
create policy "user can manage own supplement logs" on supplement_logs for all using (is_own_user_id(user_id));

create policy "user can manage own bevel" on bevel_daily for all using (is_own_user_id(user_id));

create policy "user can manage own books" on books for all using (is_own_user_id(user_id));
create policy "user can manage own reading sessions" on reading_sessions for all using (is_own_user_id(user_id));

create policy "user can manage own sprints" on sprints for all using (is_own_user_id(user_id));
create policy "user can manage own goal projects" on goal_projects for all using (is_own_user_id(user_id));
create policy "user can manage own lead measures" on lead_measures for all using (
  exists (select 1 from goal_projects gp where gp.id = goal_project_id and is_own_user_id(gp.user_id))
);
create policy "user can manage own lead logs" on lead_measure_logs for all using (
  exists (select 1 from lead_measures lm join goal_projects gp on gp.id = lm.goal_project_id where lm.id = lead_measure_id and is_own_user_id(gp.user_id))
);
create policy "user can manage own lag measures" on lag_measures for all using (
  exists (select 1 from goal_projects gp where gp.id = goal_project_id and is_own_user_id(gp.user_id))
);
create policy "user can manage own lag logs" on lag_measure_logs for all using (
  exists (select 1 from lag_measures lm join goal_projects gp on gp.id = lm.goal_project_id where lm.id = lag_measure_id and is_own_user_id(gp.user_id))
);

create policy "user can manage own projects" on side_projects for all using (is_own_user_id(user_id));
create policy "user can manage own milestones" on side_project_milestones for all using (
  exists (select 1 from side_projects sp where sp.id = side_project_id and is_own_user_id(sp.user_id))
);
create policy "user can manage own tasks" on daily_tasks for all using (is_own_user_id(user_id));
