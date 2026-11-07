import hashlib
import json
import os
import posixpath
import secrets
import threading
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))


def load_env_file():
    """Load KEY=value pairs from .env (real environment variables win)."""
    try:
        with open(os.path.join(ROOT, ".env"), encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))
    except OSError:
        pass


load_env_file()
BLOCKED_TOP_LEVEL = {"data", "supabase", "scripts", "node_modules", "server.js", "server.py", "package.json", "package-lock.json"}

DATA_DIR = os.path.join(ROOT, "data")
DB_FILE = os.path.join(DATA_DIR, "store.json")
PORT = int(os.environ.get("PORT", "3000"))
HOST = os.environ.get("HOST", "0.0.0.0")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "owner12345@gmail.com").lower()
OWNER_PASSWORD = os.environ.get("OWNER_PASSWORD", "owner54321")
LOCATIONS = {
    "Metro Manila": {"region": "National Capital Region", "cities": {
        "Manila": ["Barangay 1", "Barangay 2", "Barangay 3"],
        "Quezon": ["Commonwealth", "Batasan Hills", "Holy Spirit"],
        "Makati": ["Poblacion", "Bel-Air", "San Lorenzo"],
        "Pasig": ["Bagong Ilog", "Kapitolyo", "San Antonio"]}},
    "Cebu": {"region": "Central Visayas", "cities": {
        "Cebu": ["Apas", "Lahug", "Mabolo"], "Mandaue": ["Banilad", "Cabancalan", "Tipolo"]}},
    "Davao del Sur": {"region": "Davao Region", "cities": {
        "Davao": ["Buhangin", "Matina", "Poblacion"]}},
    "Laguna": {"region": "CALABARZON", "cities": {
        "Santa Rosa": ["Balibago", "Canlalay", "Tagapo"], "Calamba": ["Canlubang", "Halang", "Real"]}},
}
LOCK = threading.Lock()
PSGC_CACHE = {}

def psgc_get(url):
    if url in PSGC_CACHE:
        return PSGC_CACHE[url]
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "CJudeLocalStore/1.0"})
        with urllib.request.urlopen(request, timeout=8) as result:
            value = json.loads(result.read().decode("utf-8"))
        PSGC_CACHE[url] = value
        return value
    except (OSError, ValueError):
        return None

def remote_provinces():
    return psgc_get("https://psgc.gitlab.io/api/provinces/") or []

def find_remote_province(name):
    return next((item for item in remote_provinces() if item.get("name") == name), None)

def remote_region_name(code):
    if not code:
        return ""
    region = psgc_get("https://psgc.gitlab.io/api/regions/%s/" % code)
    return region.get("name", "") if region else ""

def remote_location_valid(shipping):
    province = find_remote_province(shipping.get("province", ""))
    if not province:
        return False
    cities = psgc_get("https://psgc.gitlab.io/api/provinces/%s/cities-municipalities/" % province["code"]) or []
    city = next((item for item in cities if item.get("name") == shipping.get("city")), None)
    if not city:
        return False
    barangays = psgc_get("https://psgc.gitlab.io/api/cities-municipalities/%s/barangays/" % city["code"]) or []
    return any(item.get("name") == shipping.get("barangay") for item in barangays)

def db_read():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DB_FILE):
        db_write({"users": [], "orders": [], "sessions": {}})
    with open(DB_FILE, encoding="utf-8") as file:
        return json.load(file)

def db_write(value):
    os.makedirs(DATA_DIR, exist_ok=True)
    temp = DB_FILE + ".tmp"
    with open(temp, "w", encoding="utf-8") as file:
        json.dump(value, file, indent=2)
    os.replace(temp, DB_FILE)

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return salt + ":" + digest.hex()

def password_valid(password, stored):
    salt, expected = stored.split(":", 1)
    return secrets.compare_digest(password_hash(password, salt).split(":", 1)[1], expected)

def response(handler, status, payload):
    raw = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(raw)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def is_blocked(self):
        """Never serve secrets, server code, or database files over HTTP."""
        parts = [part for part in posixpath.normpath(unquote(urlparse(self.path).path)).split("/") if part and part != "."]
        return any(part.startswith(".") for part in parts) or (bool(parts) and parts[0] in BLOCKED_TOP_LEVEL)

    def send_head(self):
        if self.is_blocked():
            self.send_error(404, "Not found")
            return None
        return super().send_head()

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def user(self, db):
        value = self.headers.get("Authorization", "").replace("Bearer ", "", 1)
        session = db["sessions"].get(value)
        if not session or session["expiresAt"] < __import__("time").time() * 1000:
            return None
        if session["userId"] == "owner":
            return {"id": "owner", "name": "Store Owner", "email": OWNER_EMAIL, "role": "owner"}
        return next((user for user in db["users"] if user["id"] == session["userId"]), None)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/env.js":
            raw = ("window.__ENV = %s;" % json.dumps({
                "SUPABASE_URL": os.environ.get("SUPABASE_URL", "http://127.0.0.1:54321"),
                "SUPABASE_ANON_KEY": os.environ.get("SUPABASE_ANON_KEY", ""),
            })).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(raw)
            return
        if not parsed.path.startswith("/api/"):
            return super().do_GET()
        query = parse_qs(parsed.query)
        if parsed.path == "/api/locations/provinces":
            remote = remote_provinces()
            names = sorted({item["name"] for item in remote if item.get("name")} | set(LOCATIONS))
            return response(self, 200, names)
        if parsed.path == "/api/locations/cities":
            province_name = query.get("province", [""])[0]
            province = find_remote_province(province_name)
            if province:
                cities = psgc_get("https://psgc.gitlab.io/api/provinces/%s/cities-municipalities/" % province["code"]) or []
                return response(self, 200, {"region": remote_region_name(province.get("regionCode")), "cities": sorted(item["name"] for item in cities)})
            province = LOCATIONS.get(province_name, {})
            return response(self, 200, {"region": province.get("region", ""), "cities": list(province.get("cities", {}))})
        if parsed.path == "/api/locations/barangays":
            province_name = query.get("province", [""])[0]
            city_name = query.get("city", [""])[0]
            province = find_remote_province(province_name)
            if province:
                cities = psgc_get("https://psgc.gitlab.io/api/provinces/%s/cities-municipalities/" % province["code"]) or []
                city = next((item for item in cities if item["name"] == city_name), None)
                barangays = psgc_get("https://psgc.gitlab.io/api/cities-municipalities/%s/barangays/" % city["code"]) if city else []
                return response(self, 200, {"barangays": sorted(item["name"] for item in (barangays or []))})
            province = LOCATIONS.get(province_name, {})
            return response(self, 200, {"barangays": province.get("cities", {}).get(city_name, [])})
        if parsed.path == "/api/orders":
            db = db_read()
            user = self.user(db)
            if not user:
                return response(self, 401, {"error": "Authentication required."})
            orders = db["orders"] if user["role"] == "owner" else [item for item in db["orders"] if item["customerId"] == user["id"]]
            return response(self, 200, {"orders": orders})
        return response(self, 404, {"error": "API route not found."})

    def do_POST(self):
        if self.path == "/api/auth/signup":
            body = self.body()
            email = str(body.get("email", "")).strip().lower()
            db = db_read()
            if email == OWNER_EMAIL or any(item["email"] == email for item in db["users"]):
                return response(self, 409, {"error": "That email address is already registered."})
            user = {"id": "user-" + secrets.token_hex(12), "name": str(body.get("name", "")).strip(), "email": email, "role": "consumer", "passwordHash": password_hash(str(body.get("password", ""))), "createdAt": __import__("time").time() * 1000}
            db["users"].append(user)
            with LOCK: db_write(db)
            return response(self, 201, {"user": {key: user[key] for key in ("id", "name", "email", "role")}})
        if self.path == "/api/auth/login":
            body = self.body()
            email = str(body.get("email", "")).strip().lower()
            db = db_read()
            user = {"id": "owner", "name": "Store Owner", "email": email, "role": "owner"} if email == OWNER_EMAIL and body.get("password") == OWNER_PASSWORD else next((item for item in db["users"] if item["email"] == email), None)
            if not user or ("passwordHash" in user and not password_valid(str(body.get("password", "")), user["passwordHash"])):
                return response(self, 401, {"error": "Incorrect email or password."})
            access_token = secrets.token_hex(32)
            db["sessions"][access_token] = {"userId": user["id"], "expiresAt": __import__("time").time() * 1000 + 604800000}
            with LOCK: db_write(db)
            return response(self, 200, {"token": access_token, "user": {key: user[key] for key in ("id", "name", "email", "role")}})
        if self.path == "/api/orders":
            db = db_read()
            user = self.user(db)
            body = self.body()
            shipping = body.get("shipping", {})
            province = LOCATIONS.get(shipping.get("province", ""))
            valid = shipping.get("country") == "Philippines" and ((province and shipping.get("city") in province["cities"] and shipping.get("barangay") in province["cities"][shipping.get("city")]) or remote_location_valid(shipping))
            if not user or user["role"] != "consumer":
                return response(self, 401, {"error": "Sign in as a customer to place an order."})
            if not valid:
                return response(self, 400, {"error": "Choose a valid Philippines province, city, and barangay."})
            body["customerId"] = user["id"]
            body["id"] = "CJ-" + str(int(__import__("time").time() * 1000))[-8:]
            body["createdAt"] = __import__("time").time() * 1000
            body["status"] = "New"
            db["orders"].insert(0, body)
            with LOCK: db_write(db)
            return response(self, 201, {"order": body})
        return response(self, 404, {"error": "API route not found."})

    def do_PATCH(self):
        if not self.path.startswith("/api/orders/"):
            return response(self, 404, {"error": "API route not found."})
        db = db_read()
        user = self.user(db)
        if not user or user["role"] != "owner":
            return response(self, 403, {"error": "Owner access required."})
        order_id = self.path.rsplit("/", 1)[-1]
        order = next((item for item in db["orders"] if item["id"] == order_id), None)
        body = self.body()
        allowed = {"New", "Preparing", "Packed", "Shipped", "Delivered", "Cancelled"}
        if not order or body.get("status") not in allowed:
            return response(self, 400, {"error": "Invalid order status."})
        order["status"] = body["status"]
        with LOCK:
            db_write(db)
        return response(self, 200, {"order": order})

if __name__ == "__main__":
    print("C'JUDE CO. running at http://localhost:%s" % PORT)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
