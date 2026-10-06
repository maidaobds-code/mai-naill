create table if not exists product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  parent_id uuid references product_categories(id),
  name text not null,
  slug text not null,
  image_url text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  slug text not null,
  logo_url text,
  description text,
  website text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  name text not null,
  slug text not null,
  short_description text,
  description text,
  product_type text not null,
  category_id uuid references product_categories(id),
  brand_id uuid references brands(id),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','HIDDEN','OUT_OF_STOCK','DISCONTINUED')),
  sku text,
  barcode text,
  base_price integer not null default 0,
  sale_price integer,
  cost_price integer not null default 0,
  tax_rate numeric(5,4) not null default 0.1,
  track_inventory boolean not null default true,
  allow_backorder boolean not null default false,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 0,
  weight numeric(10,2),
  width numeric(10,2),
  height numeric(10,2),
  length numeric(10,2),
  featured boolean not null default false,
  online_store_enabled boolean not null default false,
  pos_enabled boolean not null default true,
  seo_title text,
  meta_description text,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug),
  unique (organization_id, sku)
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  price integer not null default 0,
  sale_price integer,
  cost_price integer not null default 0,
  stock_quantity integer not null default 0,
  weight numeric(10,2),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','HIDDEN','OUT_OF_STOCK','DISCONTINUED','DRAFT')),
  attributes_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, sku)
);

create table if not exists product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  media_type text not null check (media_type in ('IMAGE','VIDEO')),
  url text not null,
  thumbnail_url text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists inventory_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variants(id) on delete cascade,
  location_id uuid not null references inventory_locations(id) on delete cascade,
  quantity_available integer not null default 0,
  quantity_reserved integer not null default 0,
  quantity_damaged integer not null default 0,
  quantity_incoming integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_variant_id, location_id),
  check (quantity_available >= 0),
  check (quantity_reserved >= 0),
  check (quantity_damaged >= 0),
  check (quantity_incoming >= 0)
);

create table if not exists inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variants(id),
  location_id uuid not null references inventory_locations(id),
  type text not null check (type in ('PURCHASE','SALE','ONLINE_ORDER','POS_SALE','RETURN','REFUND','ADJUSTMENT','TRANSFER','DAMAGED','STOCKTAKE')),
  quantity integer not null,
  before_quantity integer not null,
  after_quantity integer not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  salon_id uuid,
  customer_id uuid,
  order_number text not null,
  status text not null default 'PENDING' check (status in ('DRAFT','PENDING','CONFIRMED','PROCESSING','COMPLETED','CANCELLED','REFUNDED')),
  payment_status text not null default 'UNPAID' check (payment_status in ('UNPAID','AUTHORIZED','PAID','PARTIALLY_REFUNDED','REFUNDED','FAILED')),
  fulfillment_status text not null default 'UNFULFILLED' check (fulfillment_status in ('UNFULFILLED','PARTIAL','FULFILLED','PICKED_UP')),
  subtotal integer not null default 0,
  discount integer not null default 0,
  tax integer not null default 0,
  shipping integer not null default 0,
  total integer not null default 0,
  shipping_address_json jsonb not null default '{}'::jsonb,
  billing_address_json jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  unique (organization_id, order_number)
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  variant_id uuid references product_variants(id),
  product_name_snapshot text not null,
  variant_name_snapshot text,
  sku_snapshot text,
  quantity integer not null check (quantity > 0),
  unit_price integer not null default 0,
  discount integer not null default 0,
  tax integer not null default 0,
  subtotal integer not null default 0
);

create index if not exists idx_products_org_status on products(organization_id, status);
create index if not exists idx_products_salon on products(salon_id);
create index if not exists idx_inventory_variant_location on inventory_items(product_variant_id, location_id);
create index if not exists idx_orders_org_created on orders(organization_id, created_at desc);

alter table product_categories enable row level security;
alter table brands enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_media enable row level security;
alter table inventory_locations enable row level security;
alter table inventory_items enable row level security;
alter table inventory_transactions enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
