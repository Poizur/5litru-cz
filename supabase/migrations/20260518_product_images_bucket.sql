-- Public storage bucket for product hero images uploaded via admin UI.
-- (AI pipeline writes Olivator URLs directly; this bucket is for manual swaps.)
--
-- Apply via: supabase db push  (or paste into SQL editor on the 5litru project)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5 * 1024 * 1024,  -- 5 MB cap, plenty for webp/jpg hero images
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read so <img src> works without signed URLs
drop policy if exists "anon_read_product_images" on storage.objects;
create policy "anon_read_product_images" on storage.objects
  for select to anon using (bucket_id = 'product-images');

-- Service role: full access (admin upload endpoint uses service-role client)
drop policy if exists "service_role_all_product_images" on storage.objects;
create policy "service_role_all_product_images" on storage.objects
  for all to service_role using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
