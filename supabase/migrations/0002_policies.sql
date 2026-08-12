-- HotelPilot AI — RLS policies
-- Helper: current employee's role/hotel, read from the employees table.

create or replace function auth_employee_hotel_id()
returns uuid language sql stable as $$
  select hotel_id from employees where id = auth.uid();
$$;

create or replace function auth_is_master_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from employees
    where id = auth.uid() and role = 'master_admin' and status = 'active'
  );
$$;

create or replace function auth_is_active_employee()
returns boolean language sql stable as $$
  select exists (
    select 1 from employees where id = auth.uid() and status = 'active'
  );
$$;

-- EMPLOYEES: everyone in the hotel can see the staff list; only master admin edits.
create policy employees_select on employees for select
  using (hotel_id = auth_employee_hotel_id());
create policy employees_admin_write on employees for all
  using (auth_is_master_admin() and hotel_id = auth_employee_hotel_id())
  with check (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());

-- ROOMS: staff can read/update status via app logic; only admin can create/delete.
create policy rooms_select on rooms for select
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy rooms_staff_update on rooms for update
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy rooms_admin_write on rooms for insert
  with check (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());
create policy rooms_admin_delete on rooms for delete
  using (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());

-- GUESTS: any active employee can create/read; only admin can hard-delete.
create policy guests_select on guests for select
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy guests_insert on guests for insert
  with check (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy guests_update on guests for update
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy guests_admin_delete on guests for delete
  using (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());

-- STAYS: staff create/read/update (checkout, extension); no deletes except admin.
create policy stays_select on stays for select
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy stays_insert on stays for insert
  with check (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy stays_update on stays for update
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy stays_admin_delete on stays for delete
  using (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());

-- PAYMENTS: append-only for staff (insert + select). No update/delete for anyone
-- except master admin, and even then it should go through an audited server action.
create policy payments_select on payments for select
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy payments_insert on payments for insert
  with check (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy payments_admin_delete on payments for delete
  using (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());

create policy payment_methods_select on payment_methods for select
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy payment_methods_admin_write on payment_methods for all
  using (auth_is_master_admin() and hotel_id = auth_employee_hotel_id())
  with check (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());

-- CHECKOUT CHANGES: append-only, everyone in hotel can read, staff can insert.
create policy checkout_changes_select on checkout_changes for select
  using (
    auth_is_active_employee() and exists (
      select 1 from stays s where s.id = stay_id and s.hotel_id = auth_employee_hotel_id()
    )
  );
create policy checkout_changes_insert on checkout_changes for insert
  with check (
    auth_is_active_employee() and exists (
      select 1 from stays s where s.id = stay_id and s.hotel_id = auth_employee_hotel_id()
    )
  );

-- SHIFTS, SHIFT_ROOM_CHECKS, SHIFT_EVENTS: readable/writable by any active employee
-- in the hotel; only master admin can force-close/take over another's shift
-- (enforced in application logic + audit log, not purely by RLS).
create policy shifts_select on shifts for select
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy shifts_insert on shifts for insert
  with check (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());
create policy shifts_update on shifts for update
  using (hotel_id = auth_employee_hotel_id() and auth_is_active_employee());

create policy shift_room_checks_select on shift_room_checks for select
  using (
    auth_is_active_employee() and exists (
      select 1 from shifts sh where sh.id = shift_id and sh.hotel_id = auth_employee_hotel_id()
    )
  );
create policy shift_room_checks_insert on shift_room_checks for insert
  with check (
    auth_is_active_employee() and exists (
      select 1 from shifts sh where sh.id = shift_id and sh.hotel_id = auth_employee_hotel_id()
    )
  );

create policy shift_events_select on shift_events for select
  using (
    auth_is_active_employee() and exists (
      select 1 from shifts sh where sh.id = shift_id and sh.hotel_id = auth_employee_hotel_id()
    )
  );
create policy shift_events_insert on shift_events for insert
  with check (
    auth_is_active_employee() and exists (
      select 1 from shifts sh where sh.id = shift_id and sh.hotel_id = auth_employee_hotel_id()
    )
  );

-- AUDIT LOGS: readable by master admin only (staff see just their own actions);
-- inserts happen via a security-definer function, never direct client inserts.
create policy audit_logs_admin_select on audit_logs for select
  using (auth_is_master_admin() and hotel_id = auth_employee_hotel_id());
create policy audit_logs_self_select on audit_logs for select
  using (employee_id = auth.uid());
revoke insert on audit_logs from authenticated, anon, public;

-- HOTELS: readable by employees of that hotel; only admin edits settings.
create policy hotels_select on hotels for select
  using (id = auth_employee_hotel_id());
create policy hotels_admin_update on hotels for update
  using (auth_is_master_admin() and id = auth_employee_hotel_id());
