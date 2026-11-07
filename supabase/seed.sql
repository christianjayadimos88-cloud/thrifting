-- Sample listings (same three pieces the demo shipped with). Safe to re-run.
insert into public.products (name, category, size, condition, stock, price, description) values
  ('Vintage Graphic Tee',   'Shirts',  'M',  'Very Good', 1, 280, 'Pre-loved graphic tee. Clean condition with light signs of normal wear.'),
  ('Classic Denim Jacket',  'Jackets', 'L',  'Excellent', 1, 650, 'Structured denim jacket in excellent pre-loved condition.'),
  ('Relaxed Cargo Pants',   'Bottoms', '32', 'Good',      1, 420, 'Relaxed cargo pants with practical pockets and visible character from previous use.')
on conflict do nothing;
