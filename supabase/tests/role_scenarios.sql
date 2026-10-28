-- Role scenarios against the migrations, run by run.sh after bootstrap.sql and
-- every file in supabase/migrations. Each block prints "PASS: ..." or stops
-- the run with "FAIL: ..." (psql runs with ON_ERROR_STOP).
--
-- Requests are simulated the way PostgREST makes them: switch to the
-- authenticated (or anon) role with request.jwt.claim.sub set to the user's id.

\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- Fixed ids so later blocks can refer to rows created by earlier ones.
\set student_a    '''a0000000-0000-4000-8000-00000000000a'''
\set student_b    '''b0000000-0000-4000-8000-00000000000b'''
\set professor    '''c0000000-0000-4000-8000-00000000000c'''
\set tech_1       '''d0000000-0000-4000-8000-0000000000d1'''
\set tech_2       '''d0000000-0000-4000-8000-0000000000d2'''
\set admin        '''e0000000-0000-4000-8000-00000000000e'''

\set as_postgres  'reset role; reset request.jwt.claim.sub;'
\set as_anon      'reset role; reset request.jwt.claim.sub; set role anon;'
\set as_student_a 'reset role; set request.jwt.claim.sub = ''a0000000-0000-4000-8000-00000000000a''; set role authenticated;'
\set as_student_b 'reset role; set request.jwt.claim.sub = ''b0000000-0000-4000-8000-00000000000b''; set role authenticated;'
\set as_professor 'reset role; set request.jwt.claim.sub = ''c0000000-0000-4000-8000-00000000000c''; set role authenticated;'
\set as_tech_1    'reset role; set request.jwt.claim.sub = ''d0000000-0000-4000-8000-0000000000d1''; set role authenticated;'
\set as_tech_2    'reset role; set request.jwt.claim.sub = ''d0000000-0000-4000-8000-0000000000d2''; set role authenticated;'
\set as_admin     'reset role; set request.jwt.claim.sub = ''e0000000-0000-4000-8000-00000000000e''; set role authenticated;'

-- 1. Sign-up -----------------------------------------------------------------
-- The auth service inserts into auth.users; the profile must follow, with the
-- name from the metadata and role student whatever the form asked for.

:as_postgres
insert into auth.users (id, email, raw_user_meta_data) values
  (:student_a, 'ana@unison.mx',    '{"first_name": "Ana", "last_name": "López", "role": "admin"}'),
  (:student_b, 'beto@unison.mx',   '{"first_name": "Beto", "last_name": "Ruiz", "role": "student"}'),
  (:professor, 'paula@unison.mx',  '{"first_name": "Paula", "last_name": "Soto", "role": "professor"}'),
  (:tech_1,    'tomas@unison.mx',  '{"first_name": "Tomás", "last_name": "Vega", "role": "technician"}'),
  (:tech_2,    'teresa@unison.mx', '{"first_name": "Teresa", "last_name": "Mora"}'),
  (:admin,     'admin@unison.mx',  '{}');

do $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a';
  if p.id is null then raise exception 'FAIL: sign-up did not create a profile'; end if;
  if p.first_name <> 'Ana' or p.last_name <> 'López' then
    raise exception 'FAIL: sign-up profile has name % %', p.first_name, p.last_name;
  end if;
  if p.role <> 'student' then
    raise exception 'FAIL: sign-up metadata role "admin" was honoured (role is %)', p.role;
  end if;
  if (select count(*) from public.profiles where role = 'student') <> 6 then
    raise exception 'FAIL: not every sign-up got a student profile';
  end if;
  if (select first_name from public.profiles where id = 'e0000000-0000-4000-8000-00000000000e') <> '' then
    raise exception 'FAIL: sign-up without metadata did not get an empty name';
  end if;
  raise notice 'PASS 1: sign-up creates a student profile from the metadata, ignoring the requested role';
end $$;

-- 2. Promoting the first admin from the SQL editor ---------------------------

update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin@unison.mx');
update public.profiles set role = 'technician'
where id in (select id from auth.users where email in ('tomas@unison.mx', 'teresa@unison.mx'));
update public.profiles set role = 'professor'
where id = (select id from auth.users where email = 'paula@unison.mx');

do $$
begin
  if (select role from public.profiles p join auth.users u using (id) where u.email = 'admin@unison.mx') <> 'admin' then
    raise exception 'FAIL: SQL editor could not promote the first admin';
  end if;
  raise notice 'PASS 2: the SQL editor (postgres) can set roles, which is how the first admin is promoted';
end $$;

-- 3. Students create tickets the way the ticket form does --------------------

:as_student_a
insert into public.tickets (id, ticket_number, title, description, category, creator_id, status, priority)
values ('f0000000-0000-4000-8000-000000000001', 'TK-0042', 'Sin WiFi en biblioteca',
        'No conecta desde ayer', 'wifi_campus', :student_a, 'nuevo', 'media');
insert into public.tickets (id, title, description, category, creator_id)
values ('f0000000-0000-4000-8000-000000000002', 'sin wifi en biblioteca ',
        'Otra vez', 'wifi_campus', :student_a);

:as_student_b
insert into public.tickets (id, title, description, category, creator_id)
values ('f0000000-0000-4000-8000-000000000003', 'Correo no sincroniza',
        'Outlook', 'correo_institucional', :student_b);

:as_professor
insert into public.tickets (id, title, description, category, creator_id, priority)
values ('f0000000-0000-4000-8000-000000000004', 'Proyector aula 5',
        'No enciende', 'proyector_aula', :professor, 'alta');

:as_student_a
do $$
declare
  n text;
begin
  select ticket_number into n from public.tickets where id = 'f0000000-0000-4000-8000-000000000001';
  if n is null or n !~ '^TK-[0-9]{4,}$' or n = 'TK-0042' then
    raise exception 'FAIL: ticket number % was not assigned by the database', n;
  end if;
  if (select status from public.tickets where id = 'f0000000-0000-4000-8000-000000000002') <> 'nuevo' then
    raise exception 'FAIL: new ticket does not default to nuevo';
  end if;
  raise notice 'PASS 3: a student creates a ticket; the database assigns % and ignores the client''s number', n;
end $$;

do $$
begin
  begin
    insert into public.tickets (title, description, category, creator_id)
    values ('Ajeno', 'x', 'otro_estudiante', 'b0000000-0000-4000-8000-00000000000b');
    raise exception 'FAIL: student created a ticket in someone else''s name';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.tickets (title, description, category, creator_id, assigned_to_id)
    values ('Asignado', 'x', 'otro_estudiante', 'a0000000-0000-4000-8000-00000000000a',
            'd0000000-0000-4000-8000-0000000000d1');
    raise exception 'FAIL: student created a pre-assigned ticket';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 4: a student cannot create tickets for someone else or pre-assigned ones';
end $$;

-- 4. Students see only their own tickets -------------------------------------

:as_student_b
do $$
begin
  if exists (select 1 from public.tickets where id = 'f0000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: student B can read student A''s ticket';
  end if;
  if (select count(*) from public.tickets) <> 1 then
    raise exception 'FAIL: student B sees % tickets, expected only their own', (select count(*) from public.tickets);
  end if;
  update public.tickets set status = 'cerrado' where id = 'f0000000-0000-4000-8000-000000000001';
  raise notice 'PASS 5: a student cannot read another student''s ticket';
end $$;

:as_student_a
do $$
begin
  if (select count(*) from public.tickets) <> 2 then
    raise exception 'FAIL: student A sees % tickets, expected 2', (select count(*) from public.tickets);
  end if;
  if (select status from public.tickets where id = 'f0000000-0000-4000-8000-000000000001') <> 'nuevo' then
    raise exception 'FAIL: student B managed to change student A''s ticket';
  end if;
  update public.tickets set status = 'cerrado' where id = 'f0000000-0000-4000-8000-000000000001';
  if (select status from public.tickets where id = 'f0000000-0000-4000-8000-000000000001') <> 'nuevo' then
    raise exception 'FAIL: a student changed the status of their own ticket';
  end if;
  raise notice 'PASS 6: a student sees their own tickets and cannot change them or another student''s';
end $$;

-- 5. Profiles ----------------------------------------------------------------

do $$
begin
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: student set their own role';
  exception when insufficient_privilege then null;
  end;
  if public.current_app_role() <> 'student' then
    raise exception 'FAIL: student role changed';
  end if;
  update public.profiles set first_name = 'Ana María', department = 'Ingeniería' where id = auth.uid();
  if (select first_name from public.profiles where id = auth.uid()) <> 'Ana María' then
    raise exception 'FAIL: student could not edit their own name';
  end if;
  raise notice 'PASS 7: a student cannot set their own role but can edit the rest of their profile';
end $$;

do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL: student sees % profiles, expected only their own', (select count(*) from public.profiles);
  end if;
  update public.profiles set first_name = 'Hackeado' where id = 'b0000000-0000-4000-8000-00000000000b';
  begin
    insert into public.profiles (id, first_name, last_name)
    values ('a0000000-0000-4000-8000-00000000000a', 'x', 'y');
    raise exception 'FAIL: student inserted a profile row';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 8: a student cannot read, edit or insert other profiles';
end $$;

:as_postgres
do $$
begin
  if (select first_name from public.profiles where id = 'b0000000-0000-4000-8000-00000000000b') <> 'Beto' then
    raise exception 'FAIL: student A edited student B''s profile';
  end if;
end $$;

-- 6. Admins ------------------------------------------------------------------

:as_admin
do $$
begin
  if (select count(*) from public.tickets) <> 4 then
    raise exception 'FAIL: admin sees % tickets, expected 4', (select count(*) from public.tickets);
  end if;
  if (select count(*) from public.profiles) <> 6 then
    raise exception 'FAIL: admin sees % profiles, expected 6', (select count(*) from public.profiles);
  end if;
  -- AdminTickets: reassign to a technician.
  update public.tickets set assigned_to_id = 'd0000000-0000-4000-8000-0000000000d1', status = 'asignado'
  where id = 'f0000000-0000-4000-8000-000000000001';
  update public.tickets set assigned_to_id = 'd0000000-0000-4000-8000-0000000000d2', status = 'asignado'
  where id = 'f0000000-0000-4000-8000-000000000003';
  if (select count(*) from public.tickets where assigned_to_id is not null) <> 2 then
    raise exception 'FAIL: admin could not assign tickets';
  end if;
  -- UserManagement: change a role.
  update public.profiles set department = 'TI' where id = 'd0000000-0000-4000-8000-0000000000d1';
  update public.profiles set role = 'professor' where id = 'b0000000-0000-4000-8000-00000000000b';
  update public.profiles set role = 'student' where id = 'b0000000-0000-4000-8000-00000000000b';
  raise notice 'PASS 9: an admin sees every ticket and profile, assigns tickets and changes roles';
end $$;

-- 7. Technicians -------------------------------------------------------------

:as_tech_1
do $$
declare
  visible uuid[];
begin
  select array_agg(id order by id) into visible from public.tickets;
  -- Assigned to tech 1: ticket 1. Open queue: tickets 2 and 4. Ticket 3 is tech 2's.
  if visible <> array['f0000000-0000-4000-8000-000000000001',
                      'f0000000-0000-4000-8000-000000000002',
                      'f0000000-0000-4000-8000-000000000004']::uuid[] then
    raise exception 'FAIL: technician sees %', visible;
  end if;
  raise notice 'PASS 10: a technician sees the tickets assigned to them and the open queue, not other technicians'' tickets';
end $$;

do $$
begin
  -- TicketDetailDrawer: status change plus history entry.
  update public.tickets set status = 'en_progreso', updated_at = now()
  where id = 'f0000000-0000-4000-8000-000000000001';
  insert into public.ticket_history (ticket_id, user_id, action)
  values ('f0000000-0000-4000-8000-000000000001', auth.uid(), 'Estado cambiado a "En Progreso"');
  update public.tickets set priority = 'alta' where id = 'f0000000-0000-4000-8000-000000000001';
  update public.tickets set status = 'resuelto' where id = 'f0000000-0000-4000-8000-000000000001';
  if (select resolved_at from public.tickets where id = 'f0000000-0000-4000-8000-000000000001') is null then
    raise exception 'FAIL: resolving a ticket did not set resolved_at';
  end if;

  -- Another technician's ticket is out of reach.
  update public.tickets set status = 'cerrado' where id = 'f0000000-0000-4000-8000-000000000003';

  -- What the requester wrote cannot be rewritten.
  begin
    update public.tickets set description = 'cambiada' where id = 'f0000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: technician rewrote a ticket description';
  exception when insufficient_privilege then null;
  end;

  -- Taking a ticket from the queue is allowed, handing it to someone else is not.
  update public.tickets set assigned_to_id = auth.uid(), status = 'asignado'
  where id = 'f0000000-0000-4000-8000-000000000004';
  if (select assigned_to_id from public.tickets where id = 'f0000000-0000-4000-8000-000000000004') is distinct from auth.uid() then
    raise exception 'FAIL: technician could not take a ticket from the queue';
  end if;
  begin
    update public.tickets set assigned_to_id = 'd0000000-0000-4000-8000-0000000000d2'
    where id = 'f0000000-0000-4000-8000-000000000004';
    raise exception 'FAIL: technician reassigned a ticket to another technician';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 11: a technician updates status and priority on their tickets, takes queue tickets, and cannot touch others'' tickets or the requester''s text';
end $$;

:as_postgres
do $$
begin
  if (select status from public.tickets where id = 'f0000000-0000-4000-8000-000000000003') <> 'asignado' then
    raise exception 'FAIL: technician 1 changed technician 2''s ticket';
  end if;
end $$;

-- 8. Comments ----------------------------------------------------------------

:as_tech_1
insert into public.ticket_comments (ticket_id, user_id, content)
values ('f0000000-0000-4000-8000-000000000001', :tech_1, 'Reiniciamos el punto de acceso');

:as_student_a
insert into public.ticket_comments (ticket_id, user_id, content)
values ('f0000000-0000-4000-8000-000000000001', :student_a, 'Gracias, ya funciona');

:as_student_b
do $$
begin
  if exists (select 1 from public.ticket_comments) then
    raise exception 'FAIL: student B can read comments on student A''s ticket';
  end if;
  if exists (select 1 from public.ticket_history) then
    raise exception 'FAIL: student B can read history of student A''s ticket';
  end if;
  begin
    insert into public.ticket_comments (ticket_id, user_id, content)
    values ('f0000000-0000-4000-8000-000000000001', auth.uid(), 'spam');
    raise exception 'FAIL: student B commented on student A''s ticket';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 12: comments are visible and writable only for the ticket''s requester, technician and admins';
end $$;

:as_student_a
do $$
begin
  if (select count(*) from public.ticket_comments) <> 2 then
    raise exception 'FAIL: student A sees % comments on their ticket, expected 2', (select count(*) from public.ticket_comments);
  end if;
  begin
    insert into public.ticket_comments (ticket_id, user_id, content)
    values ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-0000000000d1', 'suplantado');
    raise exception 'FAIL: student A commented as the technician';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 13: a student reads all comments on their own ticket and cannot comment as someone else';
end $$;

-- 9. Satisfaction ratings ----------------------------------------------------

:as_student_a
insert into public.ticket_feedback (ticket_id, user_id, rating)
values ('f0000000-0000-4000-8000-000000000001', :student_a, 5);
do $$
begin
  begin
    insert into public.ticket_feedback (ticket_id, user_id, rating)
    values ('f0000000-0000-4000-8000-000000000002', auth.uid(), 1);
    raise exception 'FAIL: student rated a ticket that is not resolved';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 14: a requester rates a resolved ticket, and only a resolved one';
end $$;

-- 10. service_status is read-only to everyone but admins ----------------------

:as_student_a
do $$
declare
  rows_changed int;
begin
  if (select count(*) from public.service_status) <> 1 then
    raise exception 'FAIL: student cannot read service_status';
  end if;
  update public.service_status set wifi_campus = 'down';
  get diagnostics rows_changed = row_count;
  if rows_changed <> 0 then raise exception 'FAIL: student updated service_status'; end if;
  begin
    insert into public.service_status default values;
    raise exception 'FAIL: student inserted into service_status';
  exception when insufficient_privilege then null;
  end;
  delete from public.service_status;
  get diagnostics rows_changed = row_count;
  if rows_changed <> 0 then raise exception 'FAIL: student deleted service_status'; end if;
end $$;

:as_tech_1
do $$
declare
  rows_changed int;
begin
  update public.service_status set plataforma_lms = 'down';
  get diagnostics rows_changed = row_count;
  if rows_changed <> 0 then raise exception 'FAIL: technician updated service_status'; end if;
end $$;

:as_admin
do $$
declare
  rows_changed int;
begin
  update public.service_status set plataforma_lms = 'degraded';
  get diagnostics rows_changed = row_count;
  if rows_changed <> 1 then raise exception 'FAIL: admin could not update service_status'; end if;
  if public.get_service_status() ->> 'plataforma_lms' <> 'degraded' then
    raise exception 'FAIL: get_service_status does not reflect the update';
  end if;
  if (select wifi_campus from public.service_status) <> 'operational' then
    raise exception 'FAIL: a non-admin changed service_status';
  end if;
  raise notice 'PASS 15: service_status is readable by everyone signed in and writable only by admins';
end $$;

-- 11. Notifications are private ------------------------------------------------

:as_admin
insert into public.notifications (user_id, title, description, type) values
  (:student_a, 'Ticket resuelto', 'Tu ticket fue resuelto', 'success'),
  (:student_b, 'Bienvenido', 'Cuenta creada', 'info');

:as_student_a
do $$
declare
  rows_changed int;
begin
  if (select count(*) from public.notifications) <> 1 then
    raise exception 'FAIL: student sees % notifications, expected 1', (select count(*) from public.notifications);
  end if;
  update public.notifications set read = true;
  get diagnostics rows_changed = row_count;
  if rows_changed <> 1 then raise exception 'FAIL: student could not mark their notification read'; end if;
  begin
    insert into public.notifications (user_id, title, description)
    values ('b0000000-0000-4000-8000-00000000000b', 'falsa', 'x');
    raise exception 'FAIL: student sent a notification';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 16: notifications are visible and editable only by their recipient';
end $$;

-- 12. Anonymous requests see nothing -------------------------------------------

:as_anon
do $$
begin
  if exists (select 1 from public.tickets) or exists (select 1 from public.profiles)
     or exists (select 1 from public.service_status) or exists (select 1 from public.ticket_comments) then
    raise exception 'FAIL: anonymous request read data';
  end if;
  begin
    perform public.get_tickets_by_status();
    raise exception 'FAIL: anonymous request ran a report function';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 17: anonymous requests read nothing and cannot call the report functions';
end $$;

-- 13. Report functions ---------------------------------------------------------
-- Selecting the columns by name fails if a column the client reads is missing.

:as_admin
do $$
declare
  keys text[];
begin
  if (select sum(count) from (select status, count from public.get_tickets_by_status()) s) <> 4 then
    raise exception 'FAIL: get_tickets_by_status does not count every ticket for an admin';
  end if;
  if (select count(*) from (select category, count from public.get_tickets_by_category()) s) <> 3 then
    raise exception 'FAIL: get_tickets_by_category returned the wrong number of categories';
  end if;
  if (select count from public.get_users_by_role() where role = 'student') <> 2 then
    raise exception 'FAIL: get_users_by_role miscounts students';
  end if;
  select array_agg(k order by k) into keys from json_object_keys(public.get_service_status()) k;
  if not keys @> array['biblioteca_virtual', 'correo_institucional', 'plataforma_lms',
                       'portal_estudiantes', 'wifi_campus'] then
    raise exception 'FAIL: get_service_status keys are %', keys;
  end if;
  if (select count(*) from (
        select day, category, avg_hours, resolved_count
        from public.get_resolution_time_by_day()
        where category = 'all' and resolved_count = 1 and avg_hours >= 0) s) <> 1 then
    raise exception 'FAIL: get_resolution_time_by_day did not report the resolved ticket';
  end if;
  if exists (select 1 from public.get_resolution_time_by_day(category_filter => 'hardware')) then
    raise exception 'FAIL: get_resolution_time_by_day ignores category_filter';
  end if;
  if (select count from public.get_top_recurring_issues(category_filter => null, date_from => null, date_to => null)
      where category = 'wifi_campus') <> 2 then
    raise exception 'FAIL: get_top_recurring_issues did not group the two WiFi tickets';
  end if;
  if (select count(*) from (
        select title, category, count
        from public.get_top_recurring_issues(category_filter => 'proyector_aula',
                                             date_from => current_date - 30, date_to => current_date)) s) <> 1 then
    raise exception 'FAIL: get_top_recurring_issues filters wrongly';
  end if;
  raise notice 'PASS 18: every report function returns the columns the client reads';
end $$;

-- The functions run as the caller, so a student only counts their own tickets.
:as_student_b
do $$
begin
  if (select sum(count) from public.get_tickets_by_status()) <> 1 then
    raise exception 'FAIL: report functions bypass row level security';
  end if;
  if (select count(*) from public.get_users_by_role()) <> 1 then
    raise exception 'FAIL: get_users_by_role shows a student other profiles';
  end if;
  if public.get_service_status() is null then
    raise exception 'FAIL: a student cannot read the service status';
  end if;
  raise notice 'PASS 19: report functions run as the caller and respect row level security';
end $$;

:as_postgres
\echo 'All role scenarios passed.'
