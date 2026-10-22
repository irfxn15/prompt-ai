-- Run once in Supabase: SQL Editor > New query > paste > Run
create table if not exists public.usage (
  id bigint generated always as identity primary key,
  user_id uuid,
  email text,
  action text,
  idea text,
  created_at timestamptz default now()
);
alter table public.usage enable row level security; -- no policies: only your server (service key) can read/write

-- Handy: who is using the app (run any time)
-- select email, count(*) filter (where action='plan') as plans, count(*) filter (where action='start') as starts, max(created_at) as last_seen from public.usage group by email order by last_seen desc;
