create table if not exists public.app_state (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_users (
  id text primary key,
  name text not null,
  user_id text not null unique,
  email text,
  role text not null default 'Team',
  access_status text not null default 'Active',
  access jsonb not null default '["Content Planner"]'::jsonb,
  channels jsonb not null default '["In-app"]'::jsonb,
  notify_stages boolean not null default true,
  access_code_salt text,
  access_code_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;
alter table public.team_users enable row level security;

-- Vercel API routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- Keep anon/client-side access disabled; do not expose service-role keys in frontend code.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.app_state to service_role;
grant select, insert, update, delete on public.team_users to service_role;
