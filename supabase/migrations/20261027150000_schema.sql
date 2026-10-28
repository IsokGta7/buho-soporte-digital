-- Initial schema for a fresh Supabase project.
--
-- Tables and columns follow what the web client reads and writes: every
-- supabase.from(...) call in src/, src/integrations/supabase/types.ts, and the
-- service_status table that used to live in src/sql/. Row level security is
-- enabled in a later migration; the report functions live in their own file.

-- Enums ----------------------------------------------------------------------

create type public.user_role as enum ('student', 'professor', 'technician', 'admin');

create type public.ticket_status as enum ('nuevo', 'asignado', 'en_progreso', 'resuelto', 'cerrado');

create type public.ticket_priority as enum ('baja', 'media', 'alta', 'crítica');

create type public.service_state as enum ('operational', 'degraded', 'down');

create type public.notification_type as enum ('info', 'warning', 'success', 'error');

-- Shared trigger: keep updated_at current ------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- profiles -------------------------------------------------------------------
-- One row per auth user, created by the trigger on auth.users below.

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  role        public.user_role not null default 'student',
  department  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile, whether or not e-mail confirmation is
-- on, so the browser never has to insert one. The name comes from the sign-up
-- metadata (first_name, last_name); the role is always 'student' whatever the
-- sign-up form sent, and only an admin can change it afterwards.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    coalesce(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    coalesce(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- tickets --------------------------------------------------------------------

create sequence public.ticket_number_seq;

create table public.tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_number   text not null unique,
  title           text not null,
  description     text not null,
  category        text not null,
  status          public.ticket_status not null default 'nuevo',
  priority        public.ticket_priority not null default 'media',
  creator_id      uuid references public.profiles (id) on delete set null,
  assigned_to_id  uuid references public.profiles (id) on delete set null,
  due_date        timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index tickets_status_idx on public.tickets (status);
create index tickets_assigned_to_id_idx on public.tickets (assigned_to_id);
create index tickets_creator_id_idx on public.tickets (creator_id);
create index tickets_created_at_idx on public.tickets (created_at desc);
create index tickets_category_idx on public.tickets (category);
create index tickets_resolved_at_idx on public.tickets (resolved_at) where resolved_at is not null;

-- Ticket numbers are TK- followed by a sequence number padded to at least four
-- digits (TK-0001 ... TK-9999, TK-10000). They are always assigned here and a
-- value sent by the client is ignored, so two tickets can never collide.
create function public.assign_ticket_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint := nextval('public.ticket_number_seq');
begin
  new.ticket_number := 'TK-' || lpad(n::text, greatest(4, length(n::text)), '0');
  return new;
end;
$$;

revoke all on function public.assign_ticket_number() from public;

create trigger tickets_assign_number
  before insert on public.tickets
  for each row execute function public.assign_ticket_number();

-- resolved_at records when a ticket first reached 'resuelto' or 'cerrado' and
-- is cleared when the ticket is reopened; the resolution-time report reads it.
create function public.track_ticket_resolution()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('resuelto', 'cerrado') then
    if tg_op = 'INSERT' or old.status not in ('resuelto', 'cerrado') then
      new.resolved_at := now();
    else
      new.resolved_at := coalesce(old.resolved_at, now());
    end if;
  else
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger tickets_track_resolution
  before insert or update on public.tickets
  for each row execute function public.track_ticket_resolution();

create trigger tickets_set_updated_at
  before update on public.tickets
  for each row execute function public.set_updated_at();

-- ticket_comments ------------------------------------------------------------

create table public.ticket_comments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index ticket_comments_ticket_id_idx on public.ticket_comments (ticket_id, created_at desc);
create index ticket_comments_user_id_idx on public.ticket_comments (user_id);

-- ticket_history -------------------------------------------------------------

create table public.ticket_history (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,
  created_at  timestamptz not null default now()
);

create index ticket_history_ticket_id_idx on public.ticket_history (ticket_id, created_at desc);

-- attachments ----------------------------------------------------------------
-- Metadata only. The client lists attachments but never uploads a file, so no
-- Storage bucket is created here.

create table public.attachments (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  filename    text not null,
  path        text not null,
  mime_type   text not null,
  size        bigint not null check (size >= 0),
  created_at  timestamptz not null default now()
);

create index attachments_ticket_id_idx on public.attachments (ticket_id);

-- ticket_feedback ------------------------------------------------------------
-- One satisfaction rating per ticket, from 1 (muy insatisfecho) to 5 (muy
-- satisfecho), read by the satisfaction chart in reports.

create table public.ticket_feedback (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null unique references public.tickets (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index ticket_feedback_user_id_idx on public.ticket_feedback (user_id);

-- notifications --------------------------------------------------------------

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text not null,
  type         public.notification_type not null default 'info',
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

-- service_status -------------------------------------------------------------
-- The student dashboard shows the most recent row; one all-operational row is
-- seeded so it has something to show.

create table public.service_status (
  id                    uuid primary key default gen_random_uuid(),
  wifi_campus           public.service_state not null default 'operational',
  biblioteca_virtual    public.service_state not null default 'operational',
  plataforma_lms        public.service_state not null default 'operational',
  portal_estudiantes    public.service_state not null default 'operational',
  correo_institucional  public.service_state not null default 'operational',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index service_status_updated_at_idx on public.service_status (updated_at desc);

create trigger service_status_set_updated_at
  before update on public.service_status
  for each row execute function public.set_updated_at();

insert into public.service_status default values;

-- anuncios -------------------------------------------------------------------
-- Announcements from the IT department, listed on the student dashboard.

create table public.anuncios (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null,
  created_at   timestamptz not null default now()
);

create index anuncios_created_at_idx on public.anuncios (created_at desc);
