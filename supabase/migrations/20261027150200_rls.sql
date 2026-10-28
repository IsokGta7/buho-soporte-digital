-- Row level security for every table in public.
--
-- The browser talks to the database with the anon key, so these policies are
-- the only thing deciding who reads and writes what. Every policy applies to
-- signed-in users (the authenticated role); anonymous requests match none of
-- them and see nothing. Migrations, the SQL editor and the service role are
-- not affected.
--
-- What each role may do, mirroring what the UI offers it:
--
-- * student, professor: read their own profile and edit it except the role;
--   create tickets as themselves; read their own tickets with their comments,
--   history and attachments; comment on their own tickets; rate a ticket once
--   it is resolved.
-- * technician: everything above, plus read and work the tickets assigned to
--   them and the open queue (unassigned tickets that are not resolved or
--   closed). They can take a ticket from the queue, change status and
--   priority on their own tickets, and comment on them. They cannot reassign
--   a ticket to someone else or rewrite what the requester wrote.
-- * admin: everything.
--
-- service_status and anuncios are readable by every signed-in user and
-- writable by admins; notifications are private to their recipient.

-- Role helpers ---------------------------------------------------------------
-- SECURITY DEFINER so a policy can look up the caller's role without going
-- through the profiles policies again (which would recurse).

create function public.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create function public.is_technician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'technician', false);
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'technician'), false);
$$;

revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_technician() from public, anon;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_technician() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- Only admins change roles ----------------------------------------------------
-- Applies to requests coming through the API (anon, authenticated). The sign-up
-- trigger, the SQL editor and the service role run as other roles and are left
-- alone, which is how the first admin is promoted.

create function public.protect_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' and new.role <> 'student' then
    raise exception 'only an administrator can assign a role'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'only an administrator can change a role'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- Non-admins only move a ticket along ----------------------------------------
-- Through the API, anyone but an admin may change only status, priority and
-- the assignee of a ticket (row level security decides which tickets); the
-- requester's title, description and category stay as written.

create function public.protect_ticket_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if new.ticket_number is distinct from old.ticket_number
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.category is distinct from old.category
     or new.creator_id is distinct from old.creator_id
     or new.due_date is distinct from old.due_date
     or new.created_at is distinct from old.created_at then
    raise exception 'only status, priority and assignee can be changed on a ticket'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger tickets_protect_columns
  before update on public.tickets
  for each row execute function public.protect_ticket_columns();

-- profiles -------------------------------------------------------------------
-- Profiles are created by the sign-up trigger, so only admins insert here.

alter table public.profiles enable row level security;

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.is_admin());

create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- tickets --------------------------------------------------------------------

alter table public.tickets enable row level security;

create policy tickets_select_visible on public.tickets
  for select to authenticated
  using (
    creator_id = auth.uid()
    or public.is_admin()
    or (
      public.is_technician()
      and (
        assigned_to_id = auth.uid()
        or (assigned_to_id is null and status not in ('resuelto', 'cerrado'))
      )
    )
  );

-- A new ticket belongs to its creator, starts as 'nuevo' and is unassigned,
-- which is what the ticket form sends. Admins may create anything.
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

-- Technicians work their own tickets and may take one from the open queue,
-- but the result must stay assigned to them.
create policy tickets_update_technician on public.tickets
  for update to authenticated
  using (
    public.is_technician()
    and (
      assigned_to_id = auth.uid()
      or (assigned_to_id is null and status not in ('resuelto', 'cerrado'))
    )
  )
  with check (public.is_technician() and assigned_to_id = auth.uid());

create policy tickets_delete_admin on public.tickets
  for delete to authenticated
  using (public.is_admin());

-- ticket_comments ------------------------------------------------------------
-- Readable with the ticket (the subquery goes through the tickets policies).
-- Written, as themselves, by the ticket's creator, its technician or an admin.

alter table public.ticket_comments enable row level security;

create policy ticket_comments_select_visible_ticket on public.ticket_comments
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy ticket_comments_insert_participant on public.ticket_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (t.creator_id = auth.uid() or t.assigned_to_id = auth.uid() or public.is_admin())
    )
  );

create policy ticket_comments_update_admin on public.ticket_comments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy ticket_comments_delete_admin on public.ticket_comments
  for delete to authenticated
  using (public.is_admin());

-- ticket_history -------------------------------------------------------------
-- Append-only for everyone but admins; same writers as comments.

alter table public.ticket_history enable row level security;

create policy ticket_history_select_visible_ticket on public.ticket_history
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy ticket_history_insert_participant on public.ticket_history
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (t.creator_id = auth.uid() or t.assigned_to_id = auth.uid() or public.is_admin())
    )
  );

create policy ticket_history_delete_admin on public.ticket_history
  for delete to authenticated
  using (public.is_admin());

-- attachments ----------------------------------------------------------------
-- Visible with the ticket; added by the ticket's creator, its technician or an
-- admin; removed by admins.

alter table public.attachments enable row level security;

create policy attachments_select_visible_ticket on public.attachments
  for select to authenticated
  using (exists (select 1 from public.tickets t where t.id = ticket_id));

create policy attachments_insert_participant on public.attachments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and (t.creator_id = auth.uid() or t.assigned_to_id = auth.uid() or public.is_admin())
    )
  );

create policy attachments_update_admin on public.attachments
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy attachments_delete_admin on public.attachments
  for delete to authenticated
  using (public.is_admin());

-- ticket_feedback ------------------------------------------------------------
-- The requester rates their own ticket once it is resolved or closed; staff
-- read every rating for the reports.

alter table public.ticket_feedback enable row level security;

create policy ticket_feedback_select_own_or_staff on public.ticket_feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy ticket_feedback_insert_requester on public.ticket_feedback
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = ticket_id
        and t.creator_id = auth.uid()
        and t.status in ('resuelto', 'cerrado')
    )
  );

create policy ticket_feedback_delete_admin on public.ticket_feedback
  for delete to authenticated
  using (public.is_admin());

-- notifications --------------------------------------------------------------

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

create policy notifications_insert_admin on public.notifications
  for insert to authenticated
  with check (public.is_admin());

-- service_status -------------------------------------------------------------

alter table public.service_status enable row level security;

create policy service_status_select_all on public.service_status
  for select to authenticated
  using (true);

create policy service_status_insert_admin on public.service_status
  for insert to authenticated
  with check (public.is_admin());

create policy service_status_update_admin on public.service_status
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy service_status_delete_admin on public.service_status
  for delete to authenticated
  using (public.is_admin());

-- anuncios -------------------------------------------------------------------

alter table public.anuncios enable row level security;

create policy anuncios_select_all on public.anuncios
  for select to authenticated
  using (true);

create policy anuncios_insert_admin on public.anuncios
  for insert to authenticated
  with check (public.is_admin());

create policy anuncios_update_admin on public.anuncios
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy anuncios_delete_admin on public.anuncios
  for delete to authenticated
  using (public.is_admin());
