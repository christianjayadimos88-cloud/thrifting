const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

// Load KEY=value pairs from .env (real environment variables win).
(function loadEnvFile() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && !match[1].startsWith('#') && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* .env is optional */ }
})();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || 'owner12345@gmail.com').trim().toLowerCase();

const locations = require('./lib/locations');

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeDb({ users: [], orders: [], sessions: {} });
}
function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${DB_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(temp, DB_FILE);
}
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 1024 * 1024) reject(new Error('Payload too large')); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(`${salt}:${key.toString('hex')}`)));
}
function verifyPassword(password, stored) {
  const [salt, digest] = String(stored).split(':');
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => {
    if (error) return reject(error);
    const actual = Buffer.from(key.toString('hex'), 'hex');
    const expected = Buffer.from(digest || '', 'hex');
    resolve(actual.length === expected.length && crypto.timingSafeEqual(actual, expected));
  }));
}
function token() { return crypto.randomBytes(32).toString('hex'); }
function userFromRequest(req, db) {
  const value = req.headers.authorization || '';
  const session = db.sessions[value.replace(/^Bearer\s+/i, '')];
  if (!session || session.expiresAt < Date.now()) return null;
  return db.users.find(user => user.id === session.userId) || null;
}
function cleanUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
function validString(value, max = 200) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function sameAddress(address) {
  const province = locations[address.province];
  const city = province && province.cities[address.city];
  return Boolean(address.country === 'Philippines' && province && city && city.includes(address.barangay));
}

async function handleApi(req, res, url) {
  const db = readDb();
  if (req.method === 'GET' && url.pathname === '/api/locations/provinces') return json(res, 200, Object.keys(locations));
  if (req.method === 'GET' && url.pathname === '/api/locations/cities') {
    const province = locations[url.searchParams.get('province')];
    return json(res, 200, province ? { region: province.region, cities: Object.keys(province.cities) } : { region: '', cities: [] });
  }
  if (req.method === 'GET' && url.pathname === '/api/locations/barangays') {
    const province = locations[url.searchParams.get('province')];
    const barangays = province?.cities[url.searchParams.get('city')] || [];
    return json(res, 200, { barangays });
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!validString(body.name, 70) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || String(body.password || '').length < 8) return json(res, 400, { error: 'Enter a valid name, email, and password of at least 8 characters.' });
    if (email === OWNER_EMAIL || db.users.some(user => user.email === email)) return json(res, 409, { error: 'That email address is already registered.' });
    const user = { id: `user-${crypto.randomUUID()}`, name: body.name.trim(), email, role: 'consumer', passwordHash: await hashPassword(body.password), createdAt: Date.now() };
    db.users.push(user); writeDb(db); return json(res, 201, { user: cleanUser(user) });
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const ownerPassword = process.env.OWNER_PASSWORD || 'owner54321';
    const user = email === OWNER_EMAIL && body.password === ownerPassword ? { id: 'owner', name: 'Store Owner', email, role: 'owner' } : db.users.find(item => item.email === email);
    if (!user || (user.passwordHash && !(await verifyPassword(String(body.password || ''), user.passwordHash)))) return json(res, 401, { error: 'Incorrect email or password.' });
    const accessToken = token(); db.sessions[accessToken] = { userId: user.id, expiresAt: Date.now() + SESSION_TTL }; writeDb(db);
    return json(res, 200, { token: accessToken, user: cleanUser(user) });
  }
  if (req.method === 'POST' && url.pathname === '/api/orders') {
    const user = userFromRequest(req, db);
    if (!user || user.role !== 'consumer') return json(res, 401, { error: 'Sign in as a customer to place an order.' });
    const body = await readBody(req);
    if (!body.shipping || !sameAddress(body.shipping)) return json(res, 400, { error: 'Choose a valid Philippines province, city, and barangay.' });
    if (!validString(body.shipping.street, 120) || !validString(body.customer?.phone, 30)) return json(res, 400, { error: 'Complete the delivery address and mobile number.' });
    const order = { ...body, id: `CJ-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`, customerId: user.id, createdAt: Date.now(), status: 'New' };
    db.orders.unshift(order); writeDb(db); return json(res, 201, { order });
  }
  if (req.method === 'PATCH' && url.pathname.startsWith('/api/orders/')) {
    const user = userFromRequest(req, db);
    if (!user || user.role !== 'owner') return json(res, 403, { error: 'Owner access required.' });
    const order = db.orders.find(item => item.id === decodeURIComponent(url.pathname.split('/').pop()));
    const body = await readBody(req);
    const allowed = ['New', 'Preparing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
    if (!order || !allowed.includes(body.status)) return json(res, 400, { error: 'Invalid order status.' });
    order.status = body.status; writeDb(db); return json(res, 200, { order });
  }
  if (req.method === 'GET' && url.pathname === '/api/orders') {
    const user = userFromRequest(req, db);
    if (!user) return json(res, 401, { error: 'Authentication required.' });
    return json(res, 200, { orders: user.role === 'owner' ? db.orders : db.orders.filter(order => order.customerId === user.id) });
  }
  return json(res, 404, { error: 'API route not found.' });
}

// Never serve secrets, server code, or database files over HTTP.
const BLOCKED_TOP_LEVEL = new Set(['data', 'supabase', 'scripts', 'node_modules', 'server.js', 'server.py', 'package.json', 'package-lock.json']);
function isBlockedPath(relative) {
  const parts = relative.split(path.sep).filter(Boolean);
  return parts.some(part => part.startsWith('.')) || BLOCKED_TOP_LEVEL.has(parts[0]);
}

// Public browser config (anon key only; the service role key is never read here).
function serveEnvScript(res) {
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
  };
  res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`window.__ENV = ${JSON.stringify(config)};`);
}

function serveStatic(req, res, url) {
  if (url.pathname === '/env.js') return serveEnvScript(res);
  let requested;
  try { requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
  catch { return json(res, 400, { error: 'Bad request' }); }
  const file = path.resolve(ROOT, `.${requested}`);
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative) || isBlockedPath(relative) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return json(res, 404, { error: 'Not found' });
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
  res.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
  fs.createReadStream(file).pipe(res);
}

ensureDb();
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try { if (url.pathname.startsWith('/api/')) await handleApi(req, res, url); else serveStatic(req, res, url); }
  catch (error) { console.error(error); json(res, error.message === 'Payload too large' ? 413 : 500, { error: 'The local service could not complete that request.' }); }
}).listen(PORT, HOST, () => console.log(`C'JUDE CO. running at http://localhost:${PORT}`));
