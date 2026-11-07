# C'JUDE CO. — storefront + local Supabase

The storefront (same design, same screens) now stores everything in a **local Supabase** database:
accounts, products, product photos, ratings/feedback, store settings and orders.
`server.py` / `server.js` are now just a static file server that also serves the address lookup
(`/api/locations/*`) and the public Supabase config (`/env.js`).

```
index.html  app.js  styles.css        existing frontend (app.js now calls Supabase)
js/supabase.js  js/auth.js  js/database.js   Supabase client, auth, data access
supabase/config.toml                  local Supabase settings
supabase/migrations/*.sql             schema, RLS, order function, storage bucket
supabase/seed.sql                     three sample products
scripts/create-owner.js               creates the store-owner account
.env.example  .env.admin.example      configuration templates
server.py  server.js                  static server (+ /env.js, + address lookup)
```

## One-time setup

1. Install **Docker Desktop** and start it (wait until it says "running").
2. Install the **Supabase CLI** (`scoop install supabase`, or `npm i -g supabase`, or see supabase.com/docs/guides/cli).
3. In this folder, start Supabase (first run downloads images and applies `supabase/migrations` + `seed.sql`):
   ```
   supabase start
   ```
4. Run `supabase status`. Copy **API URL**, **anon key** and **service_role key**.
5. Create your config files:
   - Copy `.env.example` to `.env` and paste the **anon key** (this file is read by the web server and
     only the URL and anon key are ever sent to the browser).
   - Copy `.env.admin.example` to `.env.admin` and paste the **service_role key**
     (used only by the owner script below; the server never reads or serves it).
6. Create the owner account (needs Node 18+):
   ```
   node scripts/create-owner.js
   ```
   Default login: `owner12345@gmail.com` / `owner54321` (development only; set `OWNER_EMAIL` /
   `OWNER_PASSWORD` in `.env.admin` to change it).
   *No Node?* In Studio → Authentication → Add user, then in the SQL editor run
   `update public.profiles set role = 'owner' where email = 'you@example.com';`

## Run it

```
python server.py        # or: npm start
```
Open **http://localhost:3000**. Studio (view/edit tables, users, storage): **http://127.0.0.1:54323**.

Stop: `Ctrl+C` for the web server, then `supabase stop`.
Reset everything to a clean database: `supabase db reset` (this deletes all users, so re-run
`node scripts/create-owner.js` afterwards).

## Phone on the same Wi-Fi

Open `http://<your-PC-IPv4>:3000` (find it with `ipconfig`). The page automatically points the Supabase
client at the same computer, so also allow inbound port **54321** (Supabase API) and **3000** on private
networks in Windows Firewall. Guest Wi-Fi often blocks this.

## How access works

- Sign-ups are always **customers**. The owner role can only be granted by an existing owner, the
  service role, or SQL in Studio; a database trigger blocks everyone else, even if they craft requests.
- **Row Level Security** is on for every table. Customers can read the shop and their own orders, and
  create/edit/delete only their own review. Owners can manage products, photos, settings and order status.
- **Orders are created by the `place_order()` database function**, not by direct inserts. It reads prices
  and the shipping fee from the database, locks stock rows so a one-off item can't be bought twice, and
  decrements stock. Cancelling an order returns stock; re-opening takes it out again.
- Product photos live in the public `product-images` Storage bucket (owner-only uploads, JPG/PNG/WEBP, 2 MB).
- The web server refuses to serve dotfiles, `data/`, `supabase/`, `scripts/` and its own source files.

## Things to know

- **Old browser-demo data is not migrated** (it lived in localStorage). Re-add products in the owner view.
- The cart and theme/colour choices stay in the browser on purpose.
- Province/city/barangay options still come from the lookup endpoints in the server (PSGC online data in
  `server.py`, the small built-in list in `server.js`). The database checks that the address fields are
  present and the country is the Philippines, but it cannot verify a barangay against PSGC.
- The old `/api/auth/*` and `/api/orders` endpoints in `server.py` / `server.js` and `data/store.json`
  are no longer used by the site and can be deleted.
- `assets/cjude-logo.svg` is referenced by `index.html` but was not in the files provided; keep your copy in `assets/`.
- GCash is still reference-number capture only; real GCash checkout needs a merchant account and server-side credentials.
- Rename `_gitignore` to `.gitignore`.

## Manual test checklist

1. Sign up → log in as a customer → add to cart → checkout (GCash needs a reference; COD doesn't).
2. Customer: leave/update/delete a review; "My Orders" shows the order; stock dropped by the quantity.
3. Log in as owner: add a product with a photo, edit it, delete it (confirmation appears); change an order's status; cancel it and see stock return; edit store settings.
4. Studio → Table editor: rows appear in `profiles`, `orders`, `order_items`, `reviews`, `products`.
5. As a customer, in the browser console try `CJude.client().from('orders').select()` (only yours) and
   `CJude.client().from('products').delete().neq('stock', -1)` (deletes nothing).
