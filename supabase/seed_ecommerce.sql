insert into product_categories (organization_id, salon_id, name, slug, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Gel Nail', 'gel-nail', 10),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Care Product', 'care-product', 20),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Equipment', 'equipment', 30)
on conflict do nothing;

insert into brands (organization_id, name, slug, description)
values
  ('00000000-0000-0000-0000-000000000001', 'Koko Gel', 'koko-gel', 'Professional gel colors for Japanese salons.'),
  ('00000000-0000-0000-0000-000000000001', 'Luna Atelier', 'luna-atelier', 'Minimal beauty care and nail design goods.'),
  ('00000000-0000-0000-0000-000000000001', 'Mira Tools', 'mira-tools', 'Compact salon equipment and tools.')
on conflict do nothing;
