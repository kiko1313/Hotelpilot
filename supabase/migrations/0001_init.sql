-- HotelPilot AI — Stage 1: Foundation schema
-- Run this in Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ============================================================
-- HOTELS  (single-tenant for V1, but keep the table for clarity
-- and so employees/rooms/etc. reference a hotel_id from day one)
-- ============================================================
create table hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'HotelPilot AI',
  timezone text not null default 'Africa/Algiers',
  default_currency text not null default 'EUR',
  session_timeout_minutes int not null default 15,
  created_at timestamptz not null default now()
);

-- ============================================================
-- EMPLOYEES  (mirrors auth.users; role enforced here)
-- ============================================================
create type employee_role as enum ('master_admin', 'staff');
create type employee_status as enum ('active', 'disabled');

create table employees (
  id uuid primary key references auth.users(id) on delete cascade,
  hotel_id uuid not null references hotels(id) on delete cascade,
  full_name text not null,
  role employee_role not null default 'staff',
  status employee_status not null default 'active',
  failed_login_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references employees(id)
);

-- Enforce exactly one master_admin per hotel
create unique index one_master_admin_per_hotel
  on employees (hotel_id)
  where role = 'master_admin';

-- ============================================================
-- ROOMS
-- ============================================================
create type room_status as enum ('AVAILABLE', 'OCCUPIED');

create table rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  room_number text not null,
  status room_status not null default 'AVAILABLE',
  price numeric(10,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (hotel_id, room_number)
);

-- ============================================================
-- GUESTS
-- ============================================================
create table guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  identification text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references employees(id)
);

-- ============================================================
-- STAYS
-- ============================================================
create type stay_status as enum ('ACTIVE', 'CHECKED_OUT', 'CANCELLED');
create type payment_status as enum ('PAID', 'PARTIALLY_PAID', 'UNPAID');

create table stays (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  guest_id uuid not null references guests(id),
  room_id uuid not null references rooms(id),
  check_in_at timestamptz not null default now(),
  original_checkout_at timestamptz not null,
  current_checkout_at timestamptz not null,
  checked_out_at timestamptz,
  num_guests int not null default 1,
  room_price numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  amount_paid numeric(10,2) not null default 0,
  payment_status payment_status not null default 'UNPAID',
  status stay_status not null default 'ACTIVE',
  notes text,
  created_by uuid not null references employees(id),
  checked_out_by uuid references employees(id),
  created_at timestamptz not null default now()
);

create index stays_hotel_status_idx on stays (hotel_id, status);

-- ============================================================
-- PAYMENTS  (immutable — one row per payment, never edited)
-- ============================================================
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  name text not null,
  active boolean not null default true
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  stay_id uuid not null references stays(id),
  amount numeric(10,2) not null check (amount > 0),
  method_id uuid references payment_methods(id),
  employee_id uuid not null references employees(id),
  note text,
  paid_at timestamptz not null default now()
);

-- ============================================================
-- CHECKOUT CHANGES  (extensions — never overwrite, always append)
-- ============================================================
create table checkout_changes (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references stays(id),
  previous_checkout_at timestamptz not null,
  new_checkout_at timestamptz not null,
  employee_id uuid not null references employees(id),
  reason text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SHIFTS
-- ============================================================
create type shift_slot as enum ('SHIFT_1', 'SHIFT_2', 'SHIFT_3', 'CUSTOM');
create type shift_status as enum ('OPEN', 'CLOSED');

create table shifts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  slot shift_slot not null default 'CUSTOM',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status shift_status not null default 'OPEN',
  responsible_employee_id uuid not null references employees(id),
  previous_shift_id uuid references shifts(id),
  accepted_at timestamptz,
  closing_note text,
  closing_confirmed_by uuid references employees(id),
  closing_confirmed_at timestamptz
);

-- Room verification performed at shift start
create table shift_room_checks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  room_id uuid not null references rooms(id),
  expected_status room_status not null,
  reported_status room_status not null,
  is_discrepancy boolean not null default false,
  employee_id uuid not null references employees(id),
  note text,
  checked_at timestamptz not null default now()
);

-- Generic event/timeline log for a shift (takeover, handover, etc.)
create type shift_event_type as enum (
  'STARTED', 'TAKEOVER', 'HANDOVER_ACCEPTED', 'CLOSED'
);

create table shift_events (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  event_type shift_event_type not null,
  employee_id uuid not null references employees(id),
  related_employee_id uuid references employees(id), -- e.g. who was taken over from
  reason text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUDIT LOG  (append-only, no updates/deletes allowed by anyone)
-- ============================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  employee_id uuid references employees(id),
  action text not null,
  object_type text not null,
  object_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

-- Block updates/deletes on audit_logs entirely, even for admins via API.
revoke update, delete on audit_logs from public, authenticated, anon;

-- ============================================================
-- TRIGGERS: keep payment_status in sync, keep rooms in sync
-- ============================================================
create or replace function recalc_stay_payment_status()
returns trigger as $$
declare
  v_stay stays%rowtype;
  v_total_paid numeric(10,2);
begin
  select * into v_stay from stays where id = coalesce(new.stay_id, old.stay_id);

  select coalesce(sum(amount), 0) into v_total_paid
  from payments where stay_id = v_stay.id;

  update stays
  set amount_paid = v_total_paid,
      payment_status = case
        when v_total_paid <= 0 then 'UNPAID'
        when v_total_paid < v_stay.total_amount then 'PARTIALLY_PAID'
        else 'PAID'
      end
  where id = v_stay.id;

  return null;
end;
$$ language plpgsql security definer;

create trigger payments_recalc
after insert or update or delete on payments
for each row execute function recalc_stay_payment_status();

-- Enable Row Level Security everywhere; policies added in 0002_policies.sql
alter table hotels enable row level security;
alter table employees enable row level security;
alter table rooms enable row level security;
alter table guests enable row level security;
alter table stays enable row level security;
alter table payments enable row level security;
alter table payment_methods enable row level security;
alter table checkout_changes enable row level security;
alter table shifts enable row level security;
alter table shift_room_checks enable row level security;
alter table shift_events enable row level security;
alter table audit_logs enable row level security;
