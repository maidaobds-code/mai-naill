alter table appointments drop constraint if exists appointments_sync_status_check;
alter table appointments add constraint appointments_sync_status_check
  check (sync_status in ('pending','synced','partial','manual_required','error'));

alter table booking_sync drop constraint if exists booking_sync_sync_status_check;
alter table booking_sync add constraint booking_sync_sync_status_check
  check (sync_status in ('pending','synced','partial','manual_required','error'));

