create table if not exists salon_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  owner_staff_id uuid,
  name text not null,
  description text,
  image_url text,
  price integer not null default 0,
  duration_minutes integer not null default 60,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists staff_service_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  staff_id uuid not null,
  service_id uuid not null references salon_services(id) on delete cascade,
  custom_price integer,
  custom_duration_minutes integer,
  active boolean not null default true,
  unique (staff_id, service_id)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  customer_name text not null,
  customer_phone text,
  staff_id uuid not null,
  service_id uuid references salon_services(id),
  source text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','cancelled','completed','checked_out')),
  checkout_sale_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at)
);

create index if not exists idx_appointments_staff_time on appointments(staff_id, start_at, end_at);
create index if not exists idx_appointments_salon_time on appointments(salon_id, start_at);

alter table salon_services enable row level security;
alter table staff_service_skills enable row level security;
alter table appointments enable row level security;
