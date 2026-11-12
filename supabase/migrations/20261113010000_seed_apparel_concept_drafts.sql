-- Original concept illustrations for owner review only.
-- These are not photographs of actual garments and do not verify brand authenticity.
insert into public.products
  (name, category, size, condition, stock, price, status, description, image_url)
select v.name, v.category, 'Unverified', 'Needs inspection', 0, null, 'draft', v.description, v.image_url
from (values
  (
    'Adidas-style three-stripe track jacket concept (brand unverified)',
    'Jackets',
    'Original concept illustration only; not a photo of an actual garment. Suggested style reference: Adidas. Confirm the real item, brand label, authenticity, size, condition, price, and stock, then replace this image before publishing.',
    '/assets/draft-concepts/adidas-style-track-jacket.svg'
  ),
  (
    'Nike-style vintage sports tee concept (brand unverified)',
    'Tops',
    'Original concept illustration only; not a photo of an actual garment. Suggested style reference: Nike. Confirm the real item, brand label, authenticity, size, condition, price, and stock, then replace this image before publishing.',
    '/assets/draft-concepts/nike-style-sports-tee.svg'
  ),
  (
    'Champion-style color-block crewneck concept (brand unverified)',
    'Sweatshirts',
    'Original concept illustration only; not a photo of an actual garment. Suggested style reference: Champion. Confirm the real item, brand label, authenticity, size, condition, price, and stock, then replace this image before publishing.',
    '/assets/draft-concepts/champion-style-crewneck.svg'
  ),
  (
    'The North Face-style shell jacket concept (brand unverified)',
    'Jackets',
    'Original concept illustration only; not a photo of an actual garment. Suggested style reference: The North Face. Confirm the real item, brand label, authenticity, size, condition, price, and stock, then replace this image before publishing.',
    '/assets/draft-concepts/north-face-style-shell-jacket.svg'
  ),
  (
    'BAPE-style camouflage hoodie concept (brand unverified)',
    'Hoodies',
    'Original concept illustration only; not a photo of an actual garment. Suggested style reference: BAPE. Confirm the real item, brand label, authenticity, size, condition, price, and stock, then replace this image before publishing.',
    '/assets/draft-concepts/bape-style-camo-hoodie.svg'
  )
) as v(name, category, description, image_url)
where not exists (
  select 1 from public.products p where p.image_url = v.image_url
);
