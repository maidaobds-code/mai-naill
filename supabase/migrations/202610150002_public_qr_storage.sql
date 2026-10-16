-- QR images are intentionally shown to customers on public shop pages.
update storage.buckets
set public = true
where id = 'mai-beauty-assets';

drop policy if exists "public read assets" on storage.objects;

create policy "public read assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'mai-beauty-assets');
