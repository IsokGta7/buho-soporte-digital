-- Functions the dashboards and reports call through supabase.rpc(...).
--
-- All of them are SECURITY INVOKER: they run as the signed-in user, so row
-- level security decides which tickets and profiles they count. An admin gets
-- figures for the whole system; a technician only for the tickets they can
-- see; a student only for their own.
--
-- The result columns match what the components read:
--   get_tickets_by_status     AdminDashboard, TechnicianDashboard (status, count)
--   get_tickets_by_category   AdminDashboard, Reports/BarChartView (category, count)
--   get_users_by_role         AdminDashboard (role, count)
--   get_service_status        StudentDashboard (one JSON object, one key per service)
--   get_resolution_time_by_day  Reports/LineChartView (day, category, avg_hours, resolved_count)
--   get_top_recurring_issues  Reports/TicketTable (title, category, count)

create function public.get_tickets_by_status()
returns table (status text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.status::text, count(*)
  from public.tickets t
  group by t.status
  order by t.status;
$$;

create function public.get_tickets_by_category()
returns table (category text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.category, count(*)
  from public.tickets t
  group by t.category
  order by count(*) desc, t.category;
$$;

create function public.get_users_by_role()
returns table (role text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.role::text, count(*)
  from public.profiles p
  group by p.role
  order by p.role;
$$;

-- The most recent service_status row as a JSON object, or null if there is
-- none.
create function public.get_service_status()
returns json
language sql
stable
security invoker
set search_path = public
as $$
  select row_to_json(s)
  from (
    select
      wifi_campus,
      biblioteca_virtual,
      plataforma_lms,
      portal_estudiantes,
      correo_institucional,
      updated_at
    from public.service_status
    order by updated_at desc
    limit 1
  ) s;
$$;

-- Average hours from creation to resolution for the tickets resolved on each
-- day. With no category_filter the figures cover every category and the
-- category column reads 'all'; with one, only that category. date_from and
-- date_to are inclusive and filter on the day of resolution.
create function public.get_resolution_time_by_day(
  category_filter text default null,
  date_from date default null,
  date_to date default null
)
returns table (day date, category text, avg_hours numeric, resolved_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.resolved_at::date as day,
    coalesce(category_filter, 'all') as category,
    round(avg(extract(epoch from (t.resolved_at - t.created_at)) / 3600.0), 2) as avg_hours,
    count(*) as resolved_count
  from public.tickets t
  where t.resolved_at is not null
    and (category_filter is null or t.category = category_filter)
    and (date_from is null or t.resolved_at >= date_from)
    and (date_to is null or t.resolved_at < date_to + 1)
  group by t.resolved_at::date
  order by day;
$$;

-- The ten most frequent ticket titles (compared case- and space-insensitively)
-- with their category, optionally limited to one category and to tickets
-- created between date_from and date_to inclusive.
create function public.get_top_recurring_issues(
  category_filter text default null,
  date_from date default null,
  date_to date default null
)
returns table (title text, category text, count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    min(t.title) as title,
    t.category,
    count(*) as count
  from public.tickets t
  where (category_filter is null or t.category = category_filter)
    and (date_from is null or t.created_at >= date_from)
    and (date_to is null or t.created_at < date_to + 1)
  group by lower(btrim(t.title)), t.category
  order by count(*) desc, min(t.title)
  limit 10;
$$;

-- Only signed-in users call these.
revoke execute on function public.get_tickets_by_status() from public, anon;
revoke execute on function public.get_tickets_by_category() from public, anon;
revoke execute on function public.get_users_by_role() from public, anon;
revoke execute on function public.get_service_status() from public, anon;
revoke execute on function public.get_resolution_time_by_day(text, date, date) from public, anon;
revoke execute on function public.get_top_recurring_issues(text, date, date) from public, anon;

grant execute on function public.get_tickets_by_status() to authenticated;
grant execute on function public.get_tickets_by_category() to authenticated;
grant execute on function public.get_users_by_role() to authenticated;
grant execute on function public.get_service_status() to authenticated;
grant execute on function public.get_resolution_time_by_day(text, date, date) to authenticated;
grant execute on function public.get_top_recurring_issues(text, date, date) to authenticated;
