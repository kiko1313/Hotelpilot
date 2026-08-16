-- HotelPilot AI — staff ID-based login support
-- These columns were added directly against the live database in an earlier
-- session; this migration documents them so a fresh database matches.

alter table employees add column if not exists login_id text;
alter table employees add column if not exists auth_user_id uuid references auth.users(id);

create unique index if not exists employees_login_id_unique
  on employees (hotel_id, login_id)
  where login_id is not null;

-- Master Admin already manages the employees table via existing RLS
-- policies (0002_policies.sql); no policy changes needed here.
