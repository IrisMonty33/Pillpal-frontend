-- Run in the Supabase SQL editor. Keep service-role credentials on the server only.
create extension if not exists pgcrypto;
create table if not exists public.patients (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table if not exists public.patient_access (patient_id uuid not null references public.patients on delete cascade, user_id uuid not null references auth.users on delete cascade, role text not null check(role in ('patient','caregiver')), primary key(patient_id,user_id));
create table if not exists public.stations (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients on delete cascade, token_hash text not null unique, name text not null default 'PillPal station');
create table if not exists public.medications (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients on delete cascade, name text not null, dose text not null, instructions text, times text[] not null default '{}', next_refill date);
create table if not exists public.vitals (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients on delete cascade, recorded_at timestamptz not null default now(), heart_rate integer check(heart_rate between 0 and 300), spo2 integer check(spo2 between 0 and 100), temperature_c numeric(4,1), systolic integer, diastolic integer);
create table if not exists public.dose_events (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients on delete cascade, medication_id uuid references public.medications on delete set null, kind text not null check(kind in ('dispensed','taken','missed')), message text not null, occurred_at timestamptz not null default now());
create index if not exists vitals_patient_date on public.vitals(patient_id, recorded_at desc);
create index if not exists events_patient_date on public.dose_events(patient_id, occurred_at desc);
create or replace function public.can_read_patient(pid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from patient_access where patient_id=pid and user_id=(select auth.uid())) $$;
revoke all on function public.can_read_patient(uuid) from public;
grant execute on function public.can_read_patient(uuid) to authenticated;
alter table public.patients enable row level security;
alter table public.patient_access enable row level security;
alter table public.stations enable row level security;
alter table public.medications enable row level security;
alter table public.vitals enable row level security;
alter table public.dose_events enable row level security;
create policy "members see patient" on public.patients for select to authenticated using (public.can_read_patient(id));
create policy "members see own access" on public.patient_access for select to authenticated using (user_id=(select auth.uid()));
create policy "members see medications" on public.medications for select to authenticated using (public.can_read_patient(patient_id));
create policy "members see vitals" on public.vitals for select to authenticated using (public.can_read_patient(patient_id));
create policy "members see events" on public.dose_events for select to authenticated using (public.can_read_patient(patient_id));
-- No client insert/update policies: the station endpoint writes with the server-side service role.
alter publication supabase_realtime add table public.medications, public.vitals, public.dose_events;
