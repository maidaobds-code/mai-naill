create table if not exists app_kv (
  owner_id uuid not null default auth.uid(),
  key text not null,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

create table if not exists app_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  bucket text not null default 'mai-beauty-assets',
  path text not null,
  public_url text,
  owner_key text,
  mime_type text,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('mai-beauty-assets', 'mai-beauty-assets', false)
on conflict (id) do update set public = false;

alter table app_kv enable row level security;
alter table app_files enable row level security;

drop policy if exists "owner read app kv" on app_kv;
drop policy if exists "owner write app kv" on app_kv;
drop policy if exists "owner read app files" on app_files;
drop policy if exists "owner write app files" on app_files;
drop policy if exists "owner read assets" on storage.objects;
drop policy if exists "owner upload assets" on storage.objects;
drop policy if exists "owner update assets" on storage.objects;

create policy "owner read app kv" on app_kv for select to authenticated using (owner_id = auth.uid());
create policy "owner write app kv" on app_kv for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner read app files" on app_files for select to authenticated using (owner_id = auth.uid());
create policy "owner write app files" on app_files for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner read assets" on storage.objects for select to authenticated using (bucket_id = 'mai-beauty-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner upload assets" on storage.objects for insert to authenticated with check (bucket_id = 'mai-beauty-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner update assets" on storage.objects for update to authenticated using (bucket_id = 'mai-beauty-assets' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'mai-beauty-assets' and (storage.foldername(name))[1] = auth.uid()::text);
