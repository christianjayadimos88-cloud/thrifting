-- C'JUDE CO. storefront schema
-- Tables: profiles, products, reviews, store_settings, orders, order_items
-- Security: RLS on every table, column-level grants, owner/customer roles,
--           orders are created only through the place_order() RPC.

-- ---------------------------------------------------------------------
-- Types & helpers
-- ---------------------------------------------------------------------
create type public.app_role as enum ('customer', 'owner');

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles (one row per auth user)
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 70),
  email      text not null check (email = lower(email)),
  role       public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_key unique (email)
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- True when the calling user is an owner. SECURITY DEFINER so it can be used
-- inside policies (including policies on profiles) without recursion.
create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- New sign-ups always become customers. The role is never read from
-- client-supplied metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 70),
    lower(new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only owners (or trusted server-side contexts with no end-user JWT, such as
-- the service role or SQL run in Studio) may change a role.
create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_owner() then
      raise exception 'Only an owner can change account roles.' using errcode = '42501';
    end if;
    if auth.uid() = old.id and old.role = 'owner' then
      raise exception 'You cannot remove your own owner role.' using errcode = '42501';
    end if;
  end if;
  new.id := old.id;
  new.email := old.email;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 90),
  category    text not null check (char_length(btrim(category)) between 2 and 40),
  size        text not null check (char_length(btrim(size)) between 1 and 20),
  condition   text not null check (condition in ('Like New', 'Excellent', 'Very Good', 'Good', 'Fair')),
  stock       integer not null default 1 check (stock >= 0),
  price       numeric(10, 2) not null check (price > 0),
  description text not null check (char_length(btrim(description)) between 4 and 700),
  image_url   text,
  image_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Prevent the exact same listing from being created twice (raise its stock instead).
create unique index products_unique_listing
  on public.products (lower(btrim(name)), lower(btrim(category)), lower(btrim(size)), condition);
create index products_created_at_idx on public.products (created_at desc);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- reviews (one per customer per product)
-- ---------------------------------------------------------------------
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  feedback   text not null default '' check (char_length(feedback) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_one_per_user_product unique (product_id, user_id)
);

create index reviews_user_id_idx on public.reviews (user_id);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- store_settings (exactly one row)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id             smallint primary key default 1 check (id = 1),
  store_name     text not null check (char_length(btrim(store_name)) between 2 and 50),
  tagline        text not null check (char_length(btrim(tagline)) between 1 and 90),
  announcement   text not null check (char_length(btrim(announcement)) between 1 and 120),
  gcash_name     text not null check (char_length(btrim(gcash_name)) between 1 and 70),
  gcash_number   text not null check (char_length(btrim(gcash_number)) between 1 and 30),
  shipping_fee   numeric(10, 2) not null default 80 check (shipping_fee >= 0),
  contact_number text not null default '' check (char_length(contact_number) <= 30),
  updated_at     timestamptz not null default now()
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings
  (id, store_name, tagline, announcement, gcash_name, gcash_number, shipping_fee, contact_number)
values
  (1, 'C''JUDE CO.', 'Wear more. Waste less.', 'PRE-LOVED • CURATED • READY FOR A SECOND LIFE',
   'C''JUDE CO.', '09XX XXX XXXX', 80, '');

-- ---------------------------------------------------------------------
-- orders + order_items
-- ---------------------------------------------------------------------
create sequence public.order_number_seq;

create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default (
    'CJ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 8, '0')
  ),
  customer_id          uuid references public.profiles (id) on delete set null,
  customer_name        text not null check (char_length(btrim(customer_name)) between 2 and 70),
  customer_email       text not null,
  customer_phone       text not null check (char_length(btrim(customer_phone)) between 5 and 30),
  shipping_country     text not null check (shipping_country = 'Philippines'),
  shipping_region      text not null default '' check (char_length(shipping_region) <= 80),
  shipping_province    text not null check (char_length(btrim(shipping_province)) between 1 and 80),
  shipping_city        text not null check (char_length(btrim(shipping_city)) between 1 and 80),
  shipping_barangay    text not null check (char_length(btrim(shipping_barangay)) between 1 and 80),
  shipping_street      text not null check (char_length(btrim(shipping_street)) between 1 and 120),
  shipping_postal_code text not null check (char_length(btrim(shipping_postal_code)) between 1 and 12),
  shipping_notes       text not null default '' check (char_length(shipping_notes) <= 250),
  payment_method       text not null check (payment_method in ('gcash', 'cod')),
  gcash_reference      text not null default '' check (char_length(gcash_reference) <= 50),
  subtotal             numeric(12, 2) not null check (subtotal >= 0),
  shipping_fee         numeric(10, 2) not null check (shipping_fee >= 0),
  total                numeric(12, 2) not null check (total >= 0),
  status               text not null default 'New'
                         check (status in ('New', 'Preparing', 'Packed', 'Shipped', 'Delivered', 'Cancelled')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint orders_payment_reference check (
    (payment_method = 'gcash' and btrim(gcash_reference) <> '')
    or (payment_method = 'cod' and gcash_reference = '')
  )
);

create index orders_customer_id_idx on public.orders (customer_id);
create index orders_created_at_idx on public.orders (created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name       text not null,
  category   text not null,
  size       text not null,
  price      numeric(10, 2) not null check (price >= 0),
  qty        integer not null check (qty between 1 and 999),
  created_at timestamptz not null default now(),
  constraint order_items_one_row_per_product unique (order_id, product_id)
);

create index order_items_order_id_idx on public.order_items (order_id);

-- Cancelling an order returns its items to stock; re-opening it takes them out again.
create function public.orders_adjust_stock_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Cancelled' and old.status <> 'Cancelled' then
    update public.products p
       set stock = p.stock + i.qty
      from public.order_items i
     where i.order_id = new.id and i.product_id = p.id;
  elsif old.status = 'Cancelled' and new.status <> 'Cancelled' then
    if exists (
      select 1
        from public.order_items i
        join public.products p on p.id = i.product_id
       where i.order_id = new.id and p.stock < i.qty
    ) then
      raise exception 'Not enough stock to re-open this cancelled order.';
    end if;
    update public.products p
       set stock = p.stock - i.qty
      from public.order_items i
     where i.order_id = new.id and i.product_id = p.id;
  end if;
  return new;
end;
$$;

create trigger orders_adjust_stock
  after update of status on public.orders
  for each row execute function public.orders_adjust_stock_on_status();

-- ---------------------------------------------------------------------
-- place_order(): the ONLY way customers create orders.
-- Prices, shipping fee and stock are read from the database, never trusted
-- from the browser. Stock rows are locked so two buyers cannot take the same
-- one-off item.
-- ---------------------------------------------------------------------
create function public.place_order(
  p_items    jsonb,
  p_customer jsonb,
  p_shipping jsonb,
  p_payment  jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   public.profiles%rowtype;
  v_order_id  uuid;
  v_fee       numeric(10, 2);
  v_subtotal  numeric(12, 2) := 0;
  v_line      record;
  v_product   public.products%rowtype;
  v_method    text := lower(btrim(coalesce(p_payment ->> 'method', '')));
  v_reference text := btrim(coalesce(p_payment ->> 'gcashReference', ''));
  v_name      text := btrim(coalesce(p_customer ->> 'name', ''));
  v_phone     text := btrim(coalesce(p_customer ->> 'phone', ''));
  v_country   text := btrim(coalesce(p_shipping ->> 'country', ''));
  v_region    text := btrim(coalesce(p_shipping ->> 'region', ''));
  v_province  text := btrim(coalesce(p_shipping ->> 'province', ''));
  v_city      text := btrim(coalesce(p_shipping ->> 'city', ''));
  v_barangay  text := btrim(coalesce(p_shipping ->> 'barangay', ''));
  v_street    text := btrim(coalesce(p_shipping ->> 'street', ''));
  v_postal    text := btrim(coalesce(p_shipping ->> 'postalCode', ''));
  v_notes     text := btrim(coalesce(p_shipping ->> 'notes', ''));
begin
  if v_uid is null then
    raise exception 'Sign in as a customer to place an order.';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.role <> 'customer' then
    raise exception 'Only customer accounts can place orders.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;
  if v_method not in ('gcash', 'cod') then
    raise exception 'Choose GCash or Cash on Delivery.';
  end if;
  if v_method = 'gcash' and v_reference = '' then
    raise exception 'Enter the GCash reference number.';
  end if;
  if v_method = 'cod' then
    v_reference := '';
  end if;
  if char_length(v_name) < 2 or char_length(v_phone) < 5 then
    raise exception 'Complete the recipient name and mobile number.';
  end if;
  if v_country <> 'Philippines' or v_province = '' or v_city = '' or v_barangay = '' then
    raise exception 'Choose a valid Philippines province, city, and barangay.';
  end if;
  if v_street = '' or v_postal = '' then
    raise exception 'Complete the delivery address and postal code.';
  end if;

  select shipping_fee into v_fee from public.store_settings where id = 1;
  v_fee := coalesce(v_fee, 0);

  insert into public.orders (
    customer_id, customer_name, customer_email, customer_phone,
    shipping_country, shipping_region, shipping_province, shipping_city,
    shipping_barangay, shipping_street, shipping_postal_code, shipping_notes,
    payment_method, gcash_reference, subtotal, shipping_fee, total
  ) values (
    v_uid, v_name, v_profile.email, v_phone,
    v_country, v_region, v_province, v_city,
    v_barangay, v_street, v_postal, v_notes,
    v_method, v_reference, 0, v_fee, v_fee
  )
  returning id into v_order_id;

  -- Merge duplicate lines and lock products in a stable order (avoids deadlocks).
  for v_line in
    select (e ->> 'productId')::uuid as product_id,
           sum((e ->> 'qty')::integer) as qty
      from jsonb_array_elements(p_items) as e
     group by 1
     order by 1
  loop
    if v_line.qty < 1 or v_line.qty > 999 then
      raise exception 'Invalid item quantity.';
    end if;

    select * into v_product from public.products where id = v_line.product_id for update;
    if not found then
      raise exception 'An item in your cart is no longer available.';
    end if;
    if v_product.stock < v_line.qty then
      raise exception 'Not enough stock for "%". Only % left.', v_product.name, v_product.stock;
    end if;

    update public.products set stock = stock - v_line.qty where id = v_product.id;

    insert into public.order_items (order_id, product_id, name, category, size, price, qty)
    values (v_order_id, v_product.id, v_product.name, v_product.category, v_product.size, v_product.price, v_line.qty);

    v_subtotal := v_subtotal + v_product.price * v_line.qty;
  end loop;

  update public.orders
     set subtotal = v_subtotal, total = v_subtotal + v_fee
   where id = v_order_id;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.products       enable row level security;
alter table public.reviews        enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- profiles: read your own row (owners read all); edit your own name; owners edit roles.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_owner());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- products: any signed-in user can browse; only owners write.
create policy products_select on public.products
  for select to authenticated using (true);
create policy products_insert_owner on public.products
  for insert to authenticated with check (public.is_owner());
create policy products_update_owner on public.products
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy products_delete_owner on public.products
  for delete to authenticated using (public.is_owner());

-- reviews: everyone signed-in can read; customers manage only their own; owners can moderate.
create policy reviews_select on public.reviews
  for select to authenticated using (true);
create policy reviews_insert_customer on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_owner());
create policy reviews_update_own on public.reviews
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on public.reviews
  for delete to authenticated using (user_id = auth.uid());
create policy reviews_delete_owner on public.reviews
  for delete to authenticated using (public.is_owner());

-- store_settings: signed-in users read (checkout needs GCash details); owners update.
create policy store_settings_select on public.store_settings
  for select to authenticated using (true);
create policy store_settings_update_owner on public.store_settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- orders: customers see their own, owners see all; only owners update (status only, see grants).
-- There is deliberately no INSERT/DELETE policy: orders are created through place_order().
create policy orders_select on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or public.is_owner());
create policy orders_update_owner on public.orders
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

create policy order_items_select on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (o.customer_id = auth.uid() or public.is_owner())
  ));

-- ---------------------------------------------------------------------
-- Grants (defense in depth on top of RLS): nothing for anon, minimal for signed-in users
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.products, public.reviews, public.store_settings,
              public.orders, public.order_items
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (name, role) on public.profiles to authenticated;

grant select, insert, update, delete on public.products to authenticated;

grant select, delete on public.reviews to authenticated;
grant insert (product_id, user_id, stars, feedback) on public.reviews to authenticated;
grant update (stars, feedback) on public.reviews to authenticated;

grant select on public.store_settings to authenticated;
grant update (store_name, tagline, announcement, gcash_name, gcash_number, shipping_fee, contact_number)
  on public.store_settings to authenticated;

grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;

grant select on public.order_items to authenticated;

revoke all on function public.place_order(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, jsonb, jsonb) to authenticated;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- ---------------------------------------------------------------------
-- Storage: public-read bucket for product photos, owner-only writes
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "product images are publicly readable" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "owners upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_owner());
create policy "owners update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_owner())
  with check (bucket_id = 'product-images' and public.is_owner());
create policy "owners delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_owner());
