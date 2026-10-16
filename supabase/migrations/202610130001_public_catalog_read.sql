drop policy if exists "public read catalog kv" on app_kv;

create policy "public read catalog kv"
on app_kv
for select
to anon, authenticated
using (key in ('nail-japan-products', 'nail-japan-services'));
