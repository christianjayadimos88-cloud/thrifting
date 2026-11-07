#!/usr/bin/env node
// Creates (or repairs) the store-owner account in your LOCAL Supabase project.
// Uses the service role key through Supabase's official admin API, so it must
// only ever run on your computer. The key is read from .env.admin or the shell
// environment and is never sent to the browser.
//
//   node scripts/create-owner.js
//
// Re-run it after `supabase db reset`, which wipes all users.
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '..', file), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* file is optional */ }
}
loadEnv('.env.admin');
loadEnv('.env');

const url = (process.env.SUPABASE_URL || 'http://127.0.0.1:54321').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = String(process.env.OWNER_EMAIL || 'owner12345@gmail.com').trim().toLowerCase();
const password = process.env.OWNER_PASSWORD || 'owner54321';

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Copy .env.admin.example to .env.admin and paste the key from `supabase status`.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('OWNER_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

async function call(method, endpoint, body, extra = {}) {
  const response = await fetch(`${url}${endpoint}`, { method, headers: { ...headers, ...extra }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data };
}

async function findUserId() {
  for (let page = 1; page <= 20; page += 1) {
    const result = await call('GET', `/auth/v1/admin/users?page=${page}&per_page=200`);
    if (!result.ok) throw new Error(`Could not list users (HTTP ${result.status}).`);
    const users = result.data.users || [];
    const match = users.find((user) => String(user.email).toLowerCase() === email);
    if (match) return match.id;
    if (users.length < 200) break;
  }
  return null;
}

(async () => {
  let userId;
  const created = await call('POST', '/auth/v1/admin/users', { email, password, email_confirm: true, user_metadata: { name: 'Store Owner' } });
  if (created.ok) {
    userId = created.data.id;
    console.log(`Created auth user ${email}.`);
  } else {
    userId = await findUserId();
    if (!userId) throw new Error(`Could not create the owner (HTTP ${created.status}): ${JSON.stringify(created.data)}`);
    const updated = await call('PUT', `/auth/v1/admin/users/${userId}`, { password, email_confirm: true });
    if (!updated.ok) throw new Error(`Could not reset the owner password (HTTP ${updated.status}).`);
    console.log(`Auth user ${email} already existed; password reset.`);
  }

  const promoted = await call('PATCH', `/rest/v1/profiles?id=eq.${userId}`, { role: 'owner', name: 'Store Owner' }, { Prefer: 'return=representation' });
  if (!promoted.ok || !Array.isArray(promoted.data) || promoted.data.length !== 1) {
    throw new Error(`Could not set the owner role (HTTP ${promoted.status}). Did the migrations run? ${JSON.stringify(promoted.data)}`);
  }
  console.log(`Owner ready: ${email}`);
  if (password === 'owner54321') console.log('Note: this is the default DEVELOPMENT password. Set OWNER_PASSWORD for anything beyond local testing.');
})().catch((error) => { console.error(error.message); process.exit(1); });
