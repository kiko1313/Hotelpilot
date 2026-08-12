-- HotelPilot AI — audit log writer
-- Every server action that changes something important calls this instead of
-- inserting into audit_logs directly (which is locked down in 0002_policies.sql).

create or replace function log_audit_event(
  p_action text,
  p_object_type text,
  p_object_id uuid,
  p_previous_value jsonb default null,
  p_new_value jsonb default null,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_hotel_id uuid;
begin
  select hotel_id into v_hotel_id from employees where id = auth.uid();

  if v_hotel_id is null then
    raise exception 'No active employee session for audit logging';
  end if;

  insert into audit_logs (
    hotel_id, employee_id, action, object_type, object_id,
    previous_value, new_value, reason
  ) values (
    v_hotel_id, auth.uid(), p_action, p_object_type, p_object_id,
    p_previous_value, p_new_value, p_reason
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function log_audit_event from public;
grant execute on function log_audit_event to authenticated;
