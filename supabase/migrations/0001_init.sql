-- Rengy RBAC initial schema
-- Run this once in the Supabase SQL editor.

create extension if not exists "pgcrypto";

------------------------------------------------------------
-- profiles: mirror of auth.users with name/email
------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  created_at  timestamptz not null default now()
);

create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_name_lower_idx  on public.profiles (lower(name));

-- Auto-create a profile row whenever a new auth user is created.
-- Name comes from raw_user_meta_data.name (set by signup), fallback to email local-part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------
-- teams + memberships
------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.team_memberships (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  team_id   uuid not null references public.teams(id)    on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

create index if not exists team_memberships_team_idx on public.team_memberships (team_id);

------------------------------------------------------------
-- roles + permissions (global, reusable)
------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text
);

create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  description text
);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id)       on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

------------------------------------------------------------
-- user_team_roles: the core many-to-many-to-many.
-- Composite PK allows multiple roles per (user, team).
------------------------------------------------------------
create table if not exists public.user_team_roles (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  team_id     uuid not null references public.teams(id)    on delete cascade,
  role_id     uuid not null references public.roles(id)    on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, team_id, role_id)
);

create index if not exists utr_user_team_idx on public.user_team_roles (user_id, team_id);
create index if not exists utr_team_idx      on public.user_team_roles (team_id);

------------------------------------------------------------
-- audit log
------------------------------------------------------------
create table if not exists public.audit_log (
  id              bigserial primary key,
  actor_user_id   uuid references public.profiles(id) on delete set null,
  action          text not null,
  team_id         uuid references public.teams(id)    on delete set null,
  target_user_id  uuid references public.profiles(id) on delete set null,
  role_id         uuid references public.roles(id)    on delete set null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists audit_log_team_idx       on public.audit_log (team_id, created_at desc);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

------------------------------------------------------------
-- RLS: enable everywhere; deny everything to anon + authenticated.
-- The Netlify Functions use the service-role key, which bypasses RLS.
-- This means the only path to data is through our middleware-checked endpoints.
------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.teams            enable row level security;
alter table public.team_memberships enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_team_roles  enable row level security;
alter table public.audit_log        enable row level security;
-- (No policies created -> RLS denies all non-service-role access.)
