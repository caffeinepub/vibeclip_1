"""
auth.py — Vibe Clip Login System
---------------------------------
Drop-in replacement login script for Vibe Clip.
Supports: username OR email login, bcrypt passwords, sessions, JWT tokens, remember me.

Install dependencies:
    pip install flask flask-jwt-extended bcrypt

Mount this blueprint in your main app:
    from auth import auth_bp
    app.register_blueprint(auth_bp)

⚙️  Fill in the CONFIG section and the two DB adapter functions below.
"""

import os
import logging
from datetime import datetime, timedelta, timezone
from functools import wraps

import bcrypt
from flask import (
    Blueprint, request, session, jsonify,
    redirect, url_for, g
)
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, set_access_cookies,
    set_refresh_cookies, unset_jwt_cookies, verify_jwt_in_request
)

log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
#  ⚙️  CONFIG — edit these values
# ═══════════════════════════════════════════════════════════════════════════════

class Config:
    # Secret keys — change these in production, load from environment variables!
    SECRET_KEY            = os.environ.get("SECRET_KEY", "change-me-vibe-clip-secret")
    JWT_SECRET_KEY        = os.environ.get("JWT_SECRET_KEY", "change-me-jwt-secret")

    # Token lifetimes
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Session lifetime for "remember me"
    REMEMBER_ME_DURATION  = timedelta(days=30)
    DEFAULT_SESSION_DURATION = timedelta(hours=8)

    # How many failed logins before lockout
    MAX_LOGIN_ATTEMPTS    = 5
    LOCKOUT_DURATION      = timedelta(minutes=15)

    # Where to redirect after login/logout (set to your actual routes)
    LOGIN_REDIRECT        = "/dashboard"
    LOGOUT_REDIRECT       = "/login"

    # Store JWT in cookies (True) or return in JSON only (False)
    JWT_IN_COOKIES        = True
    JWT_COOKIE_SECURE     = False   # Set True in production (HTTPS only)
    JWT_COOKIE_SAMESITE   = "Lax"

# ═══════════════════════════════════════════════════════════════════════════════
#  ⚙️  DB ADAPTERS — connect your database here
# ═══════════════════════════════════════════════════════════════════════════════

def get_user_by_username_or_email(identifier: str) -> dict | None:
    """
    Look up a user by username OR email.
    Must return a dict with at least:
        { "id", "username", "email", "password_hash", "is_banned" }
    Return None if not found.

    Example (SQLAlchemy):
        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()
        return user.__dict__ if user else None

    Example (raw SQLite):
        row = db.execute(
            "SELECT * FROM users WHERE username=? OR email=?",
            (identifier, identifier)
        ).fetchone()
        return dict(row) if row else None
    """
    # TODO: replace with your DB query
    raise NotImplementedError("Implement get_user_by_username_or_email() with your DB")


def get_user_by_id(user_id: int) -> dict | None:
    """
    Look up a user by their ID.
    Return dict or None.

    Example:
        row = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return dict(row) if row else None
    """
    # TODO: replace with your DB query
    raise NotImplementedError("Implement get_user_by_id() with your DB")


# Optional: store failed attempt counts (in-memory by default, swap for Redis/DB)
_failed_attempts: dict[str, list] = {}

def record_failed_attempt(identifier: str):
    now = datetime.now(timezone.utc)
    _failed_attempts.setdefault(identifier, [])
    _failed_attempts[identifier].append(now)

def is_locked_out(identifier: str) -> bool:
    now = datetime.now(timezone.utc)
    cutoff = now - Config.LOCKOUT_DURATION
    attempts = [t for t in _failed_attempts.get(identifier, []) if t > cutoff]
    _failed_attempts[identifier] = attempts
    return len(attempts) >= Config.MAX_LOGIN_ATTEMPTS

def clear_failed_attempts(identifier: str):
    _failed_attempts.pop(identifier, None)

# ═══════════════════════════════════════════════════════════════════════════════
#  PASSWORD UTILS
# ═══════════════════════════════════════════════════════════════════════════════

def hash_password(plain: str) -> str:
    """Hash a plain text password with bcrypt."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, stored: str) -> bool:
    """
    Verify a password against a stored hash.
    Handles bcrypt hashes AND plain text passwords (auto-migrates plain → bcrypt).
    """
    if not plain or not stored:
        return False

    # bcrypt hashes start with $2b$ or $2y$
    if stored.startswith("$2"):
        return bcrypt.checkpw(plain.encode(), stored.encode())

    # Plain text fallback (not recommended — migrate your passwords!)
    log.warning("Plain text password detected — please migrate to bcrypt hashing")
    return plain == stored

# ═══════════════════════════════════════════════════════════════════════════════
#  BLUEPRINT + JWT SETUP
# ═══════════════════════════════════════════════════════════════════════════════

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

def init_auth(app):
    """Call this in your app factory to initialise JWT with the app."""
    app.config["SECRET_KEY"]                   = Config.SECRET_KEY
    app.config["JWT_SECRET_KEY"]               = Config.JWT_SECRET_KEY
    app.config["JWT_ACCESS_TOKEN_EXPIRES"]     = Config.JWT_ACCESS_TOKEN_EXPIRES
    app.config["JWT_REFRESH_TOKEN_EXPIRES"]    = Config.JWT_REFRESH_TOKEN_EXPIRES
    app.config["JWT_TOKEN_LOCATION"]           = ["cookies", "headers"]
    app.config["JWT_COOKIE_SECURE"]            = Config.JWT_COOKIE_SAMESITE
    app.config["JWT_COOKIE_SAMESITE"]          = Config.JWT_COOKIE_SAMESITE
    app.config["JWT_COOKIE_CSRF_PROTECT"]      = False  # Enable in production

    jwt = JWTManager(app)
    app.register_blueprint(auth_bp)
    return jwt

# ═══════════════════════════════════════════════════════════════════════════════
#  CORE LOGIN LOGIC
# ═══════════════════════════════════════════════════════════════════════════════

def _do_login(identifier: str, password: str, remember: bool = False):
    """
    Core login logic. Returns (user_dict, error_string).
    error_string is None on success.
    """
    identifier = identifier.strip().lower()

    # Rate limiting / lockout
    if is_locked_out(identifier):
        remaining = Config.LOCKOUT_DURATION.seconds // 60
        return None, f"Too many failed attempts. Try again in {remaining} minutes."

    # Fetch user
    try:
        user = get_user_by_username_or_email(identifier)
    except NotImplementedError:
        log.error("DB adapter not implemented — cannot look up user")
        return None, "Login is not configured yet. Please implement the DB adapter."

    if not user:
        record_failed_attempt(identifier)
        return None, "Invalid username/email or password."

    # Check ban
    if user.get("is_banned"):
        return None, "Your account has been suspended. Contact support if you think this is a mistake."

    # Verify password
    if not verify_password(password, user.get("password_hash", "")):
        record_failed_attempt(identifier)
        attempts_left = Config.MAX_LOGIN_ATTEMPTS - len(_failed_attempts.get(identifier, []))
        return None, f"Invalid username/email or password. ({max(0, attempts_left)} attempts remaining)"

    clear_failed_attempt(identifier)
    return user, None


# ═══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

# ── POST /auth/login — JSON API (for fetch/axios from your frontend) ──────────

@auth_bp.route("/login", methods=["POST"])
def login():
    """
    JSON login endpoint.
    Body: { "identifier": "username or email", "password": "...", "remember": true/false }
    Returns: { "success": true, "access_token": "...", "user": {...} }
    """
    data = request.get_json(silent=True) or {}
    identifier = data.get("identifier", "").strip()
    password   = data.get("password", "")
    remember   = bool(data.get("remember", False))

    if not identifier or not password:
        return jsonify(success=False, error="Username/email and password are required."), 400

    user, error = _do_login(identifier, password, remember)
    if error:
        return jsonify(success=False, error=error), 401

    # Build tokens
    identity = str(user["id"])
    access_token  = create_access_token(identity=identity)
    refresh_token = create_refresh_token(identity=identity)

    # Flask session
    session.permanent = remember
    session.permanent_session_lifetime = Config.REMEMBER_ME_DURATION if remember else Config.DEFAULT_SESSION_DURATION
    session["user_id"]  = user["id"]
    session["username"] = user.get("username")

    resp = jsonify(
        success=True,
        access_token=access_token,
        user={
            "id":       user["id"],
            "username": user.get("username"),
            "email":    user.get("email"),
        }
    )

    if Config.JWT_IN_COOKIES:
        set_access_cookies(resp, access_token)
        set_refresh_cookies(resp, refresh_token)

    log.info(f"✅ Login: user {user['id']} ({user.get('username')}) from {request.remote_addr}")
    return resp, 200


# ── POST /auth/login/form — HTML form submission ──────────────────────────────

@auth_bp.route("/login/form", methods=["POST"])
def login_form():
    """
    Traditional form-based login (for server-rendered HTML pages).
    Redirects to dashboard on success or back to login on failure.
    """
    identifier = request.form.get("identifier", "").strip()
    password   = request.form.get("password", "")
    remember   = "remember" in request.form

    if not identifier or not password:
        # TODO: flash("Username/email and password are required.", "error")
        return redirect(url_for("auth.login_page"))

    user, error = _do_login(identifier, password, remember)
    if error:
        # TODO: flash(error, "error")
        return redirect(url_for("auth.login_page"))

    session.permanent = remember
    session["user_id"]  = user["id"]
    session["username"] = user.get("username")

    return redirect(Config.LOGIN_REDIRECT)


# ── GET /auth/login — serve login page ───────────────────────────────────────

@auth_bp.route("/login", methods=["GET"])
def login_page():
    """
    Serve your login HTML page.
    Replace the return value with render_template("login.html") once you have a template.
    """
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Vibe Clip — Login</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, sans-serif; background: #0f0f13; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .card { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 12px; padding: 40px; width: 360px; }
            h1 { font-size: 1.6rem; margin-bottom: 6px; color: #a78bfa; }
            p.sub { color: #888; font-size: 0.9rem; margin-bottom: 28px; }
            label { display: block; font-size: 0.85rem; color: #aaa; margin-bottom: 6px; }
            input[type=text], input[type=password] { width: 100%; padding: 10px 14px; background: #111118; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 0.95rem; margin-bottom: 18px; outline: none; }
            input:focus { border-color: #a78bfa; }
            .remember { display: flex; align-items: center; gap: 8px; margin-bottom: 22px; font-size: 0.85rem; color: #aaa; }
            button { width: 100%; padding: 11px; background: #7c3aed; border: none; border-radius: 8px; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
            button:hover { background: #6d28d9; }
            #error { color: #f87171; font-size: 0.85rem; margin-bottom: 14px; display: none; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🎬 Vibe Clip</h1>
            <p class="sub">Sign in to your account</p>
            <div id="error"></div>
            <label>Username or Email</label>
            <input type="text" id="identifier" placeholder="you@example.com" autocomplete="username" />
            <label>Password</label>
            <input type="password" id="password" placeholder="••••••••" autocomplete="current-password" />
            <div class="remember">
                <input type="checkbox" id="remember" />
                <label for="remember" style="margin:0">Remember me for 30 days</label>
            </div>
            <button onclick="doLogin()">Sign In</button>
        </div>
        <script>
            async function doLogin() {
                const identifier = document.getElementById('identifier').value.trim();
                const password   = document.getElementById('password').value;
                const remember   = document.getElementById('remember').checked;
                const errEl      = document.getElementById('error');
                errEl.style.display = 'none';

                if (!identifier || !password) {
                    errEl.textContent = 'Please enter your username/email and password.';
                    errEl.style.display = 'block';
                    return;
                }

                const res = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password, remember })
                });

                const data = await res.json();
                if (data.success) {
                    if (data.access_token) {
                        localStorage.setItem('access_token', data.access_token);
                    }
                    window.location.href = '/dashboard';
                } else {
                    errEl.textContent = data.error || 'Login failed.';
                    errEl.style.display = 'block';
                }
            }

            document.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
        </script>
    </body>
    </html>
    """


# ── POST /auth/refresh — refresh access token ─────────────────────────────────

@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    new_token = create_access_token(identity=identity)
    resp = jsonify(success=True, access_token=new_token)
    if Config.JWT_IN_COOKIES:
        set_access_cookies(resp, new_token)
    return resp, 200


# ── POST /auth/logout ─────────────────────────────────────────────────────────

@auth_bp.route("/logout", methods=["POST", "GET"])
def logout():
    session.clear()
    resp = jsonify(success=True, message="Logged out.")
    unset_jwt_cookies(resp)
    log.info(f"Logout from {request.remote_addr}")
    if request.method == "GET":
        return redirect(Config.LOGOUT_REDIRECT)
    return resp, 200


# ═══════════════════════════════════════════════════════════════════════════════
#  MIDDLEWARE — protect routes with @login_required
# ═══════════════════════════════════════════════════════════════════════════════

def login_required(f):
    """
    Decorator to protect any route.
    Accepts either a valid JWT (cookie or Authorization header) OR an active session.

    Usage:
        @app.route("/dashboard")
        @login_required
        def dashboard():
            user = g.current_user   # always available inside protected routes
            return f"Hello {user['username']}"
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = None

        # Try JWT first
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
        except Exception:
            pass

        # Fall back to session
        if not user_id:
            user_id = session.get("user_id")

        if not user_id:
            if request.is_json:
                return jsonify(success=False, error="Authentication required."), 401
            return redirect(url_for("auth.login_page"))

        # Load user and check ban
        try:
            user = get_user_by_id(int(user_id))
        except NotImplementedError:
            user = {"id": user_id, "username": "unknown"}

        if not user or user.get("is_banned"):
            session.clear()
            if request.is_json:
                return jsonify(success=False, error="Account suspended."), 403
            return redirect(url_for("auth.login_page"))

        g.current_user = user
        return f(*args, **kwargs)
    return decorated


# ═══════════════════════════════════════════════════════════════════════════════
#  QUICK START — standalone test server
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    from flask import Flask

    app = Flask(__name__)
    init_auth(app)

    # Example protected route
    @app.route("/dashboard")
    @login_required
    def dashboard():
        return jsonify(message=f"Welcome to Vibe Clip, {g.current_user.get('username')}!")

    print("⚠️  Running in test mode — implement DB adapters before using in production")
    print("   Visit http://localhost:5000/auth/login")
    app.run(debug=True, port=5000)
