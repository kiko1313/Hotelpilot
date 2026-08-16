-- HotelPilot AI — fix circular RLS dependency on the employees table
--
-- Root cause: auth_employee_hotel_id() / auth_is_master_admin() /
-- auth_is_active_employee() queried `employees`, which is itself governed
-- by RLS policies that call these same functions. Without SECURITY DEFINER,
-- Postgres could not resolve "what is my hotel_id" without already knowing
-- it — so every employee's own row silently returned zero results, and the
-- app's UI defaulted an unknown role to "Staff".

create or replace function auth_employee_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hotel_id from employees where id = auth.uid();
$$;

create or replace function auth_is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees
    where id = auth.uid() and role = 'master_admin' and status = 'active'
  );
$$;

create or replace function auth_is_active_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees where id = auth.uid() and status = 'active'
  );
$$;

-- Defense in depth: every employee can always read their own row directly,
-- independent of the helper functions above.
drop policy if exists employees_select_own on employees;
create policy employees_select_own on employees for select
  using (id = auth.uid());
