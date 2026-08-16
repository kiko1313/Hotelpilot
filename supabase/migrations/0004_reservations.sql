-- HotelPilot AI — reservations support
-- Adds a RESERVED state so a future booking shows differently from an
-- occupied room or an empty available room (per spec: booking != check-in).

alter type room_status add value if not exists 'RESERVED';
alter type stay_status add value if not exists 'RESERVED';

-- A stay can now exist before check-in happens: arrival_at is the expected
-- date, check_in_at is only filled in once the guest actually arrives.
alter table stays add column if not exists arrival_at timestamptz;
update stays set arrival_at = check_in_at where arrival_at is null;
alter table stays alter column arrival_at set not null;

alter table stays alter column check_in_at drop not null;
alter table stays alter column check_in_at drop default;

-- Helper view: one row per stay with guest/room names and computed balance,
-- so every list screen shows payment status without re-deriving it.
create or replace view stays_with_details
with (security_invoker = true) as
select
  s.*,
  g.full_name as guest_name,
  g.phone as guest_phone,
  r.room_number,
  (s.total_amount - s.amount_paid) as balance
from stays s
join guests g on g.id = s.guest_id
join rooms r on r.id = s.room_id;
