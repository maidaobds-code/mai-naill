-- Allow the public shop/booking pages to load payment settings, including
-- the QR image URL uploaded to Supabase Storage.
drop policy if exists "public read settings kv" on app_kv;

create policy "public read settings kv"
on app_kv
for select
to anon, authenticated
using (key = 'nail-japan-settings');
