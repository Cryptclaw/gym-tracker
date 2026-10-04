-- Capability-authenticated access goes through the Edge Function only.
create table public.gym_vaults (
 key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now()
);
create table public.gym_workouts (
 key_hash text not null references public.gym_vaults(key_hash),
 workout_id text not null check (length(workout_id) between 10 and 100),
 payload jsonb not null check (jsonb_typeof(payload)='object'),
 stored_at timestamptz not null default now(),
 primary key (key_hash,workout_id)
);
alter table public.gym_vaults enable row level security;
alter table public.gym_workouts enable row level security;
revoke all on public.gym_vaults,public.gym_workouts from public,anon,authenticated,service_role;
grant select,insert on public.gym_vaults,public.gym_workouts to service_role;
-- No anonymous policies, no public listing, no client update/delete API.
