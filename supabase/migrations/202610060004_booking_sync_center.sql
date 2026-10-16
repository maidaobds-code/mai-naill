create table if not exists booking_sources (
  id text primary key,
  name text not null,
  mode text not null default 'manual' check (mode in ('connected','read_only','manual','disabled')),
  supports_create boolean not null default false,
  supports_update boolean not null default false,
  supports_cancel boolean not null default false,
  supports_block boolean not null default false,
  supports_unblock boolean not null default false,
  created_at timestamptz not null default now()
);

insert into booking_sources (id, name, mode, supports_create, supports_update, supports_cancel, supports_block, supports_unblock)
values
  ('internal', 'Website đặt lịch riêng', 'connected', true, true, true, true, true),
  ('nailie', 'Nailie', 'manual', false, false, false, false, false),
  ('minimo', 'minimo', 'manual', false, false, false, false, false),
  ('hotpepper', 'HOT PEPPER Beauty / SALON BOARD', 'manual', false, false, false, false, false)
on conflict (id) do update set
  name = excluded.name,
  mode = excluded.mode,
  supports_create = excluded.supports_create,
  supports_update = excluded.supports_update,
  supports_cancel = excluded.supports_cancel,
  supports_block = excluded.supports_block,
  supports_unblock = excluded.supports_unblock;

alter table appointments
  add column if not exists external_booking_id text,
  add column if not exists sync_status text not null default 'pending' check (sync_status in ('pending','synced','partial','manual_required','error')),
  add column if not exists cancelled_at timestamptz;

create table if not exists booking_sync (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references appointments(id) on delete cascade,
  provider text not null references booking_sources(id),
  external_id text,
  sync_status text not null default 'pending' check (sync_status in ('pending','synced','partial','manual_required','error')),
  last_sync_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, provider)
);

create unique index if not exists idx_appointments_source_external
  on appointments(source, external_booking_id)
  where external_booking_id is not null;

create extension if not exists btree_gist;

alter table appointments
  drop constraint if exists appointments_no_staff_overlap;

alter table appointments
  add constraint appointments_no_staff_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status in ('pending','confirmed'));

alter table booking_sources enable row level security;
alter table booking_sync enable row level security;
