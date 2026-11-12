-- Add the eleven clothing photos omitted from the first product import.
-- Leave all unverified listing details incomplete and keep every product as a draft.
insert into public.products
  (name, category, size, condition, stock, price, status, description, image_url)
select v.name, v.category, 'Unverified', 'Needs inspection', 0, null, 'draft', v.description, v.image_url
from (values
  (
    'Black Nike sleeveless graphic top',
    'Tops',
    'Black sleeveless Nike top with a graphic. Size and condition unverified.',
    '/assets/products/nike-black-sleeveless-graphic-top.jpg'
  ),
  (
    'Beige shorts',
    'Shorts',
    'Beige shorts. Brand, size and condition unverified.',
    '/assets/products/beige-shorts.jpg'
  ),
  (
    'Blue Lee jeans',
    'Jeans',
    'Blue jeans with a visible Lee patch. Size and condition unverified.',
    '/assets/products/lee-blue-jeans.jpg'
  ),
  (
    'Multicolor striped polo shirt',
    'Shirts',
    'Striped short-sleeve collared shirt. Brand, size and condition unverified.',
    '/assets/products/multicolor-striped-polo-shirt.jpg'
  ),
  (
    'Red plaid button-up shirt',
    'Shirts',
    'Red and white plaid long-sleeve shirt. Size and condition unverified.',
    '/assets/products/red-plaid-button-up-shirt.jpg'
  ),
  (
    'Green plaid button-up shirt',
    'Shirts',
    'Green and white plaid long-sleeve shirt. Size and condition unverified.',
    '/assets/products/green-plaid-button-up-shirt.jpg'
  ),
  (
    'Black graphic T-shirt',
    'Shirts',
    'Black tee with a large illustrated chest graphic. Brand, size and condition unverified.',
    '/assets/products/black-graphic-tee.jpg'
  ),
  (
    'Black flame graphic T-shirt',
    'Shirts',
    'Black tee with a flame-style chest logo that appears to read Thrasher. Authenticity, size and condition unverified.',
    '/assets/products/black-flame-graphic-tee.jpg'
  ),
  (
    'Light-wash jeans',
    'Jeans',
    'Light-wash blue jeans. Brand, size and condition unverified.',
    '/assets/products/light-wash-jeans.jpg'
  ),
  (
    'Distressed dark-wash jeans',
    'Jeans',
    'Dark-wash jeans with visible distressed details. Brand, size and condition unverified.',
    '/assets/products/distressed-dark-jeans.jpg'
  ),
  (
    'Black adidas athletic shorts',
    'Shorts',
    'Black shorts with white panels, three stripes and visible adidas logo. Authenticity, size and condition unverified.',
    '/assets/products/adidas-black-athletic-shorts.jpg'
  )
) as v(name, category, description, image_url)
where not exists (
  select 1
    from public.products p
   where p.image_url = v.image_url
);
