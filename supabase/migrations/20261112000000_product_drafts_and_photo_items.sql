-- Allow owners to save incomplete product listings without exposing them to customers.
alter table public.products
  add column status text not null default 'published';

alter table public.products
  add constraint products_status_check check (status in ('draft', 'published'));

alter table public.products
  alter column price drop not null;

alter table public.products
  drop constraint if exists products_price_check;

alter table public.products
  add constraint products_price_check check (price is null or price > 0);

alter table public.products
  drop constraint if exists products_condition_check;

alter table public.products
  add constraint products_condition_check
  check (condition in ('Like New', 'Excellent', 'Very Good', 'Good', 'Fair', 'Needs inspection'));

alter table public.products
  add constraint products_published_price_check
  check (status = 'draft' or price is not null);

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated
  using (status = 'published' or public.is_owner());

create function public.ensure_product_has_publishable_details()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  should_validate boolean := false;
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      should_validate := true;
    else
      should_validate := old.status = 'draft';
    end if;
  end if;

  if should_validate and (
    new.price is null
    or new.price <= 0
    or new.stock < 1
    or new.condition = 'Needs inspection'
    or lower(btrim(new.size)) in ('unverified', 'various', 'not provided')
  ) then
    raise exception 'Confirm price, size, condition, and available stock before publishing.';
  end if;

  return new;
end;
$$;

create trigger products_require_details_before_publish
  before insert or update of status on public.products
  for each row execute function public.ensure_product_has_publishable_details();

revoke all on function public.ensure_product_has_publishable_details() from public, anon, authenticated;

-- Orders can only contain published products, even if a client guesses a draft ID.
create function public.ensure_order_item_product_is_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from public.products
     where id = new.product_id
       and status = 'published'
  ) then
    raise exception 'This product is not available for purchase.';
  end if;
  return new;
end;
$$;

create trigger order_items_require_published_product
  before insert on public.order_items
  for each row execute function public.ensure_order_item_product_is_published();

revoke all on function public.ensure_order_item_product_is_published() from public, anon, authenticated;

-- These drafts are based only on what is visible in the supplied photos.
-- Price, size, condition, and stock remain unverified until the owner reviews each item.
insert into public.products (name, category, size, condition, stock, price, status, description, image_url)
select v.name, v.category, v.size, 'Needs inspection', 0, null, 'draft', v.description, v.image_url
from (values
  (
    'The North Face black DryVent shell jacket',
    'Jackets',
    'Unverified',
    'Black hooded zip-front shell with a visible The North Face chest logo and DryVent marking. The photo does not verify the tagged size, working condition, or any flaws.',
    '/assets/products/north-face-dryvent-front.jpg'
  ),
  (
    'The North Face black GORE-TEX shell jacket',
    'Jackets',
    'Unverified',
    'Black hooded shell photographed from the back; the The North Face logo and GORE-TEX sleeve marking are visible. Front, tagged size, working condition, and flaws are not confirmed by this photo.',
    '/assets/products/north-face-gore-tex-back.jpg'
  ),
  (
    'adidas charcoal track jacket',
    'Jackets',
    'Unverified',
    'Charcoal full-zip adidas jacket with shoulder stripes and a chest logo. A small tag appears to read 29x27; its meaning and the garment size are unverified.',
    '/assets/products/adidas-charcoal-track-jacket.jpg'
  ),
  (
    'adidas navy full-zip jacket',
    'Jackets',
    'Unverified',
    'Navy full-zip adidas jacket with a stand collar and small chest logo. Tagged size, material, working condition, and flaws are not confirmed by the photo.',
    '/assets/products/adidas-navy-full-zip-jacket.jpg'
  ),
  (
    'Black color-block hooded windbreaker',
    'Jackets',
    'Unverified',
    'Black hooded zip-up windbreaker shown among three colorways. Tagged size, condition, and any flaws need to be checked before publishing.',
    '/assets/products/color-block-windbreakers.jpg'
  ),
  (
    'White and black color-block hooded windbreaker',
    'Jackets',
    'Unverified',
    'White hooded zip-up windbreaker with black color-block panels. Tagged size, condition, and any flaws need to be checked before publishing.',
    '/assets/products/white-black-windbreaker.jpg'
  ),
  (
    'Beige and white color-block hooded windbreaker',
    'Jackets',
    'Unverified',
    'Light beige hooded zip-up windbreaker with white color-block panels, shown among three colorways. Tagged size, condition, and any flaws need to be checked before publishing.',
    '/assets/products/color-block-windbreakers.jpg'
  ),
  (
    'Assorted cap collection — photo group 1',
    'Hats',
    'Various',
    'The supplied photo shows a group of assorted baseball caps in different colors, team designs, and styles. Individual cap selection, quantity, size, authenticity, and condition are not verified; split into individual listings before publishing.',
    '/assets/products/caps-group-1.jpg'
  ),
  (
    'Assorted cap collection — photo group 2',
    'Hats',
    'Various',
    'The supplied photo shows a group of assorted baseball caps in different colors and styles. Individual cap selection, quantity, size, authenticity, and condition are not verified; split into individual listings before publishing.',
    '/assets/products/caps-group-2.jpg'
  ),
  (
    'Assorted cap collection — photo group 3',
    'Hats',
    'Various',
    'The supplied photo shows a group of assorted caps, including sport and logo designs. Individual cap selection, quantity, size, authenticity, and condition are not verified; split into individual listings before publishing.',
    '/assets/products/caps-group-3.jpg'
  )
) as v(name, category, size, description, image_url)
where not exists (
  select 1
    from public.products p
   where lower(btrim(p.name)) = lower(btrim(v.name))
     and lower(btrim(p.category)) = lower(btrim(v.category))
     and lower(btrim(p.size)) = lower(btrim(v.size))
     and p.condition = 'Needs inspection'
);
