# C'JUDE CO. — storefront + local Supabase

The storefront (same design, same screens) uses Supabase for its data: local Supabase during development
and the connected Supabase project when deployed. It stores accounts, products, product photos,
ratings/feedback, store settings and orders.
`server.py` / `server.js` serve the site locally, including address lookup (`/api/locations/*`) and the
public Supabase config (`/env.js`). Vercel serves the frontend and public Supabase config as static files,
with serverless routes for address lookup.

```
index.html  app.js  styles.css        existing frontend (app.js now calls Supabase)
js/supabase.js  js/auth.js  js/database.js   Supabase client, auth, data access
supabase/config.toml                  local Supabase settings
supabase/migrations/*.sql             schema, RLS, order function, storage bucket
supabase/seed.sql                     three sample products
scripts/create-owner.js               creates the store-owner account
.env.example  .env.admin.example      configuration templates
server.py  server.js                  static server (+ /env.js, + address lookup)
assets/cjude-logo.jpg                 supplied storefront and navigation logo
assets/cjude-favicon.png              browser-tab icon generated from the supplied logo
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

## Run locally

```
python server.py        # or: npm start
```
Open **http://localhost:3000**. Studio (view/edit tables, users, storage): **http://127.0.0.1:54323**.

Stop: `Ctrl+C` for the web server, then `supabase stop`.
Reset everything to a clean database: `supabase db reset` (this deletes all users, so re-run
`node scripts/create-owner.js` afterwards).
## Deploy to Vercel

1. Apply `supabase/migrations/20261107000000_init_schema.sql` in the hosted project's SQL Editor, then
   apply `supabase/seed.sql` if you want the sample products. The migration creates the profiles,
   products, reviews, store settings, orders and order items tables, their access policies, and the
   product image bucket.
2. The public browser configuration is in `env.js`. It contains only the Supabase project URL and
   publishable key; those values are intended to be public and database access is restricted by RLS.
   The build copies this file into `dist/`, so `/env.js` is served as a static file rather than invoking
   a Vercel function. This avoids a runtime function dependency for app startup.
3. In Vercel, import this GitHub repository. The included `vercel.json` runs `npm run build` and
   publishes the generated `dist/` storefront.
4. Create an owner account in the hosted Supabase project using its dashboard or the owner setup
   script configured locally with that project's `SUPABASE_URL` and service-role key. Never add the
   service-role key to Vercel or `env.js`.
5. In Supabase Authentication URL settings, set the deployed Vercel URL as the Site URL and add your
   Vercel deployment URL(s) to the allowed redirect URLs.

To connect a different Supabase project, update `env.js` with its Project URL and publishable key.
The Vercel `/api/locations/*` routes use the same small built-in location list as the local Node server.

## Phone on the same Wi-Fi

Open `http://<your-PC-IPv4>:3000` (find it with `ipconfig`). The page automatically points the Supabase
client at the same computer, so also allow inbound port **54321** (Supabase API) and **3000** on private
networks in Windows Firewall. Guest Wi-Fi often blocks this.

## How access works

- Sign-ups are always **customers**. The owner role can only be granted by an existing owner, the
  service role, or SQL in Studio; a database trigger blocks everyone else, even if they craft requests.
- Password recovery is handled in the storefront: request a link from the login screen, open it on
  the configured Site URL, then set a new password. Add each production or local origin used for recovery
  to Supabase Authentication's allowed redirect URLs.
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
- GCash is still reference-number capture only; real GCash checkout needs a merchant account and server-side credentials.

## Manual test checklist

1. Sign up → log in as a customer → add to cart → checkout (GCash needs a reference; COD doesn't).
2. Request a password-reset link from the login screen, open it, and save a new password.
3. Customer: leave/update/delete a review; "My Orders" shows the order; stock dropped by the quantity.
4. Log in as owner: add a product with a photo, edit it, delete it (confirmation appears); change an order's status; cancel it and see stock return; edit store settings.
5. Studio → Table editor: rows appear in `profiles`, `orders`, `order_items`, `reviews`, `products`.
6. As a customer, in the browser console try `CJude.client().from('orders').select()` (only yours) and
   `CJude.client().from('products').delete().neq('stock', -1)` (deletes nothing).
