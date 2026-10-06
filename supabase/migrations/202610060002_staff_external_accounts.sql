create table if not exists staff_external_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  staff_id uuid not null,
  platform text not null check (platform in ('HOTPEPPER','NAILIE','MINIMO','DIRECT','OTHER')),
  external_account_id text,
  external_staff_id text,
  external_staff_name text,
  encrypted_credentials jsonb,
  enabled boolean not null default true,
  sync_availability boolean not null default true,
  sync_booking boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, staff_id, platform)
);

create index if not exists idx_staff_external_accounts_staff on staff_external_accounts(staff_id);
create index if not exists idx_staff_external_accounts_org_platform on staff_external_accounts(organization_id, platform);

alter table staff_external_accounts enable row level security;
