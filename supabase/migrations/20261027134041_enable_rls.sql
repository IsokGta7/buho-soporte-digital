-- Enable Row Level Security on every table the web client reads or writes.
--
-- STATUS: UNAPPLIED. This repository has no migration history for these
-- tables, so this file has never been run against the project. Apply it by
-- pasting it into the Supabase SQL editor (it runs as `postgres`), then sign
-- in as a student, a technician and an admin and walk through the app.
--
-- Where the names come from. Tables and columns were taken from the client
-- code (every supabase.from(...) call in src/ and src/integrations/supabase/
-- types.ts) and from src/sql/create_report_procedures.sql. The role values
-- 'student', 'professor', 'technician' and 'admin' come from the UserRole type
-- in src/types.ts and the zod enum in src/components/Users/UserForm.tsx; the
-- initial ticket status 'nuevo' comes from src/components/TicketForm.tsx.
-- None of it was checked against the live schema.
--
-- Read before applying:
--
-- * Every existing policy on the tables below is dropped first. A permissive
--   policy left over from the dashboard (for example "enable read access for
--   all users") would be OR-ed with the rules here and undo them. Check what
--   is there with: select * from pg_policies where schemaname = 'public';
--
-- * Roles can no longer be chosen at sign-up. A non-admin insert into
--   profiles always gets role 'student', and a non-admin update keeps the old
--   role. Professors and technicians who register are students until an admin
--   changes them in user management. The first admin has to be set here, in
--   the SQL editor:  update public.profiles set role = 'admin' where id = '...';
--
-- * Sign-up inserts the profile row from the browser right after
--   auth.signUp(). If e-mail confirmation is enabled, that call has no session
--   yet, auth.uid() is null, and the insert is refused. If that happens, the
--   fix is a trigger on auth.users that creates the profile, with the client
--   insert removed; that is a client change and is not part of this file.
--
-- * The report functions in src/sql run as the calling user, so after this
--   they only count rows the caller may see (admins and technicians see every
--   ticket, admins every profile). get_resolution_time_by_day and
--   get_top_recurring_issues are called by the client but are not defined in
--   this repo; if they are SECURITY DEFINER they bypass all of this.

begin;

-- Helpers -------------------------------------------------------------------
-- SECURITY DEFINER so policies can look up the caller's role without
-- re-entering the profiles policies (which would recurse).

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() in ('admin', 'technician'), false);
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- Start from a clean slate on the covered tables ------------------------------

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'tickets', 'ticket_comments',
                        'ticket_history', 'attachments', 'service_status')
  loop
    execute format('drop policy %I on %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- profiles ------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert_own_or_admin on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.is_admin());

create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- Only an admin may set or change a role through the API. Requests from the
-- browser run as anon or authenticated; the SQL editor, the service role and
-- migrations run as other roles and are left alone.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'student';
  else
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- tickets -------------------------------------------------------------------
-- Creators see their own tickets; admins and technicians see all of them.
-- A new ticket must belong to the caller, start as 'nuevo' and be unassigned,
-- which is what TicketForm sends. Admins reassign and edit anything;
-- technicians change status and priority on tickets assigned to them.

alter table public.tickets enable row level security;

create policy tickets_select_creator_or_staff on public.tickets
  for select to authenticated
  using (creator_id = auth.uid() or public.is_staff());

create policy tickets_insert_own_new on public.tickets
  for insert to authenticated
  with check (
    public.is_admin()
    or (creator_id = auth.uid() and status = 'nuevo' and assigned_to_id is null)
  );

create policy tickets_update_admin on public.tickets
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy tickets_update_assigned_technician on public.tickets
  for update to authenticated
  using (public.current_app_role() = 'technician' and assigned_to_id = auth.uid())
  with check (public.current_app_role() = 'technician' and assigned_to_id = auth.uid());

create policy tickets_delete_admin on public.tickets
  for delete to authenticated
  using (public.is_admin());

-- ticket_comments, ticket_history, attachments --------------------------------
-- Readable by anyone who can read the parent ticket (the subquery goes through
-- the tickets policies above). Comments and history entries are written by an
-- admin or by the technician the ticket is assigned to, as themselves, which
-- is what TicketDetailDrawer does. Nothing in the client writes attachments,
-- so only admins can.

alter table public.ticket_comments enable row level security;

create policy ticket_comments_select_visible_ticket on public.ticket_comments
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy ticket_comments_insert_staff_on_ticket on public.ticket_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.tickets t
                 where t.id = ticket_id and t.assigned_to_id = auth.uid())
    )
  );

create policy ticket_comments_update_admin on public.ticket_comments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy ticket_comments_delete_admin on public.ticket_comments
  for delete to authenticated
  using (public.is_admin());

alter table public.ticket_history enable row level security;

create policy ticket_history_select_visible_ticket on public.ticket_history
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy ticket_history_insert_staff_on_ticket on public.ticket_history
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.tickets t
                 where t.id = ticket_id and t.assigned_to_id = auth.uid())
    )
  );

create policy ticket_history_update_admin on public.ticket_history
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy ticket_history_delete_admin on public.ticket_history
  for delete to authenticated
  using (public.is_admin());

alter table public.attachments enable row level security;

create policy attachments_select_visible_ticket on public.attachments
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy attachments_write_admin on public.attachments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- service_status --------------------------------------------------------------
-- Created by src/sql/create_report_procedures.sql, which may not have been run,
-- so it is only touched if it exists. Everyone may read it (the student
-- dashboard calls get_service_status()); only admins may change it.

do $$
begin
  if to_regclass('public.service_status') is not null then
    execute 'alter table public.service_status enable row level security';
    execute $p$
      create policy service_status_select_all on public.service_status
        for select to anon, authenticated
        using (true)
    $p$;
    execute $p$
      create policy service_status_write_admin on public.service_status
        for all to authenticated
        using (public.is_admin())
        with check (public.is_admin())
    $p$;
  end if;
end $$;

commit;
