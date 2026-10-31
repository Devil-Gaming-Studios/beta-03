"""Mast Meals local API.

Implements the spec's baseline loop and security priorities on top of the SQLite store:

- access tokens (15 min, HS256) + opaque refresh tokens with rotation and reuse detection
- household and client always taken from the access token, never the request body
- confirm-before-write for every AI-proposed change (pending_actions)
- recipe scaling, weekly plan, stock check, mark-done deduction, shopping list
- audit log and sync_log deltas

Still missing (see docs/gap-analysis.md): Google OAuth consent screens in an app, receipt OCR,
STT, Swiggy MCP, Gmail order parsing, scrapers, calendar, health, uploads, Postgres.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import unicodedata
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import jsonschema
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import db

ROOT = Path(__file__).resolve().parent.parent
SYSTEM_PROMPT = (ROOT / "prompts" / "omnirush.system.txt").read_text(encoding="utf-8")
SCHEMA = json.loads((ROOT / "schemas" / "omnirush_output.schema.json").read_text(encoding="utf-8"))

PROVIDER = os.getenv("LLM_PROVIDER", "ollama").strip().lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
OLLAMA_FORMAT = os.getenv("OLLAMA_FORMAT", "json").strip().lower()
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT_SECONDS", "300"))
PENDING_TTL_MIN = float(os.getenv("PENDING_ACTION_TTL_MIN", "20"))
MAX_ITEMS = int(os.getenv("AGENT_MAX_ITEMS_PER_PROPOSAL", "25"))
INPUT_MAX_CHARS = int(os.getenv("INPUT_MAX_CHARS", "4000"))
OUTPUT_MAX_CHARS = int(os.getenv("OUTPUT_MAX_CHARS", "5000"))
MESSAGE_MAX_CHARS = 600
RATE_LIMIT_EXPENSIVE_PER_MIN = int(os.getenv("RATE_LIMIT_EXPENSIVE_PER_MIN", "20"))

JWT_SECRET = os.getenv("JWT_SIGNING_SECRET", "dev-only-insecure-signing-secret-change-me")
JWT_ISSUER = os.getenv("JWT_ISSUER", "mastmeals-api")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "mastmeals-app")
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TOKEN_TTL_MIN", "15"))
REFRESH_TTL_DAYS = int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "30"))
REFRESH_PEPPER = os.getenv("REFRESH_TOKEN_HASH_PEPPER", "dev-only-pepper-change-me")
DEV_AUTH_ALLOWED = os.getenv("DEV_AUTH_ALLOWED", "true").strip().lower() in ("1", "true", "yes")
GOOGLE_CLIENT_IDS = [
    v for v in (
        os.getenv("GOOGLE_CLIENT_ID_ANDROID", ""),
        os.getenv("GOOGLE_CLIENT_ID_IOS", ""),
        os.getenv("GOOGLE_CLIENT_ID_WEB", ""),
    ) if v
]

db.init()
app = FastAPI(title="Mast Meals local API", docs_url="/api/docs", openapi_url="/api/openapi.json")


# --------------------------------------------------------------------------- auth


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(txt: str) -> bytes:
    return base64.urlsafe_b64decode(txt + "=" * (-len(txt) % 4))


def _sign(payload: dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    parts = [_b64(json.dumps(header, separators=(",", ":")).encode()), _b64(json.dumps(payload, separators=(",", ":")).encode())]
    signing_input = ".".join(parts).encode()
    sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    return ".".join(parts) + "." + _b64(sig)


def _verify(token: str) -> dict[str, Any]:
    try:
        head_b64, body_b64, sig_b64 = token.split(".")
        header = json.loads(_unb64(head_b64))
    except Exception:
        raise HTTPException(status_code=401, detail="invalid token")
    # Algorithm is fixed: never trust the header beyond confirming it.
    if header.get("alg") != "HS256":
        raise HTTPException(status_code=401, detail="invalid token")
    expected = hmac.new(JWT_SECRET.encode(), f"{head_b64}.{body_b64}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _unb64(sig_b64)):
        raise HTTPException(status_code=401, detail="invalid token")
    claims = json.loads(_unb64(body_b64))
    now = int(time.time())
    if claims.get("iss") != JWT_ISSUER or claims.get("aud") != JWT_AUDIENCE:
        raise HTTPException(status_code=401, detail="invalid token")
    if int(claims.get("exp", 0)) < now:
        raise HTTPException(status_code=401, detail="token expired")
    if int(claims.get("iat", 0)) > now + 60:
        raise HTTPException(status_code=401, detail="invalid token")
    return claims


def _hash_refresh(token: str) -> str:
    return hashlib.sha256((REFRESH_PEPPER + token).encode()).hexdigest()


def issue_tokens(conn, user_id: str, household_id: str, client_id: str, role: str, family_id: str | None = None) -> dict[str, Any]:
    now = int(time.time())
    access = _sign({
        "sub": user_id, "hh": household_id, "cid": client_id, "role": role,
        "iss": JWT_ISSUER, "aud": JWT_AUDIENCE, "iat": now,
        "exp": now + ACCESS_TTL_MIN * 60, "jti": db.new_id(),
    })
    refresh = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO refresh_tokens (id, user_id, client_id, family_id, token_hash, expires_at, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        (db.new_id(), user_id, client_id, family_id or db.new_id(), _hash_refresh(refresh),
         time.time() + REFRESH_TTL_DAYS * 86400, db.now()),
    )
    conn.commit()
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer",
            "expires_in": ACCESS_TTL_MIN * 60, "household_id": household_id, "client_id": client_id}


def current(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    claims = _verify(authorization.split(" ", 1)[1].strip())
    conn = db.connect()
    try:
        member = conn.execute(
            "SELECT role FROM household_users WHERE user_id = ? AND household_id = ?",
            (claims["sub"], claims["hh"]),
        ).fetchone()
        client = conn.execute(
            "SELECT id FROM clients WHERE id = ? AND household_id = ?", (claims["cid"], claims["hh"])
        ).fetchone()
    finally:
        conn.close()
    if not member or not client:
        raise HTTPException(status_code=401, detail="membership no longer valid")
    return {"user_id": claims["sub"], "household_id": claims["hh"], "client_id": claims["cid"],
            "role": member["role"]}


class DevLoginIn(BaseModel):
    household_name: str = "My Kitchen"
    email: str = "dev@local"
    name: str = "Dev User"


@app.post("/auth/dev-login")
def dev_login(body: DevLoginIn) -> dict[str, Any]:
    if not DEV_AUTH_ALLOWED:
        raise HTTPException(status_code=403, detail="dev login disabled")
    conn = db.connect()
    try:
        row = conn.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
        client_id = db.new_id()
        if row:
            user_id = row["id"]
            hh = conn.execute(
                "SELECT household_id, role FROM household_users WHERE user_id = ?", (user_id,)
            ).fetchone()
            household_id = hh["household_id"] if hh else db.create_household(conn, user_id, body.household_name, client_id)
        else:
            user_id = db.new_id()
            conn.execute(
                "INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?,?,?,?,?)",
                (user_id, f"dev:{body.email}", body.email, body.name, db.now()),
            )
            household_id = db.create_household(conn, user_id, body.household_name, client_id)
            db.audit(conn, household_id, user_id, "household_created", {"name": body.household_name})
        conn.execute(
            "INSERT INTO clients (id, household_id, label, last_pulled_seq, created_at) VALUES (?,?,?,?,?)",
            (client_id, household_id, "device", 0, db.now()),
        )
        tokens = issue_tokens(conn, user_id, household_id, client_id, "owner")
        db.audit(conn, household_id, user_id, "login", {"mode": "dev"})
        conn.commit()
        return {"user_id": user_id, **tokens}
    finally:
        conn.close()


class GoogleIn(BaseModel):
    id_token: str


@app.post("/auth/google")
def google_login(body: GoogleIn) -> dict[str, Any]:
    """Verify a Google ID token, then link by Google subject id (never email)."""
    if not GOOGLE_CLIENT_IDS:
        raise HTTPException(status_code=400, detail="no Google client ids configured; use /auth/dev-login")
    try:
        info = httpx.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": body.id_token}, timeout=10)
        info.raise_for_status()
        claims = info.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=401, detail="invalid Google id token")
    if claims.get("aud") not in GOOGLE_CLIENT_IDS:
        raise HTTPException(status_code=401, detail="invalid Google id token")
    if claims.get("iss") not in ("https://accounts.google.com", "accounts.google.com"):
        raise HTTPException(status_code=401, detail="invalid Google id token")
    if str(claims.get("email_verified", "")).lower() != "true":
        raise HTTPException(status_code=401, detail="email not verified")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="invalid Google id token")
    conn = db.connect()
    try:
        row = conn.execute("SELECT id FROM users WHERE google_sub = ?", (sub,)).fetchone()
        client_id = db.new_id()
        if row:
            user_id = row["id"]
            hh = conn.execute(
                "SELECT household_id FROM household_users WHERE user_id = ?", (user_id,)
            ).fetchone()
            household_id = hh["household_id"] if hh else db.create_household(conn, user_id, "My Kitchen", client_id)
        else:
            user_id = db.new_id()
            conn.execute(
                "INSERT INTO users (id, google_sub, email, name, created_at) VALUES (?,?,?,?,?)",
                (user_id, sub, claims.get("email"), claims.get("name"), db.now()),
            )
            household_id = db.create_household(conn, user_id, "My Kitchen", client_id)
        conn.execute(
            "INSERT INTO clients (id, household_id, label, last_pulled_seq, created_at) VALUES (?,?,?,?,?)",
            (client_id, household_id, "device", 0, db.now()),
        )
        tokens = issue_tokens(conn, user_id, household_id, client_id, "owner")
        db.audit(conn, household_id, user_id, "login", {"mode": "google"})
        conn.commit()
        return {"user_id": user_id, **tokens}
    finally:
        conn.close()


class RefreshIn(BaseModel):
    refresh_token: str
    client_id: str


@app.post("/auth/refresh")
def refresh(body: RefreshIn) -> dict[str, Any]:
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT * FROM refresh_tokens WHERE token_hash = ?", (_hash_refresh(body.refresh_token),)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="invalid refresh token")
        if row["revoked_at"] or (row["used_at"] and row["used_at"] >= 0):
            # Reuse of a spent token: assume theft, revoke the whole family.
            conn.execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL",
                (time.time(), row["family_id"]),
            )
            user = conn.execute(
                "SELECT hh.household_id FROM household_users hh WHERE hh.user_id = ?", (row["user_id"],)
            ).fetchone()
            db.audit(conn, user["household_id"] if user else None, row["user_id"], "refresh_reuse_detected",
                     {"family_id": row["family_id"]})
            conn.commit()
            raise HTTPException(status_code=401, detail="refresh token reused; session revoked")
        if row["expires_at"] < time.time():
            raise HTTPException(status_code=401, detail="refresh token expired")
        if row["client_id"] != body.client_id:
            raise HTTPException(status_code=401, detail="refresh token bound to another device")
        conn.execute("UPDATE refresh_tokens SET used_at = ? WHERE id = ?", (time.time(), row["id"]))
        hh = conn.execute(
            "SELECT household_id, role FROM household_users WHERE user_id = ?", (row["user_id"],)
        ).fetchone()
        tokens = issue_tokens(conn, row["user_id"], hh["household_id"], body.client_id, hh["role"],
                             family_id=row["family_id"])
        conn.commit()
        return tokens
    finally:
        conn.close()


@app.post("/auth/logout")
def logout(ctx: dict = Depends(current)) -> dict[str, str]:
    conn = db.connect()
    try:
        conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE client_id = ? AND revoked_at IS NULL",
            (time.time(), ctx["client_id"]),
        )
        db.audit(conn, ctx["household_id"], ctx["user_id"], "logout", {})
        conn.commit()
    finally:
        conn.close()
    return {"status": "logged_out"}


# --------------------------------------------------------------------------- helpers


def monday_of(value: str | None) -> str:
    if not value:
        today = date.today()
    else:
        try:
            today = datetime.strptime(value, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=422, detail="week_start must be YYYY-MM-DD")
    return (today - timedelta(days=today.weekday())).isoformat()


def get_or_create_plan(conn, household_id: str, week_start: str) -> str:
    row = conn.execute(
        "SELECT id FROM meal_plans WHERE household_id = ? AND week_start = ?", (household_id, week_start)
    ).fetchone()
    if row:
        return row["id"]
    pid = db.new_id()
    conn.execute(
        "INSERT INTO meal_plans (id, household_id, week_start) VALUES (?,?,?)", (pid, household_id, week_start)
    )
    db.bump_sync(conn, household_id, "meal_plans", pid, "upsert", "server")
    return pid


def ensure_household_recipes(conn, household_id: str, client_id: str) -> None:
    """Mirror canonical recipes into the household table the first time they are needed."""
    count = conn.execute(
        "SELECT COUNT(*) AS c FROM household_recipes WHERE household_id = ? AND deleted_at IS NULL",
        (household_id,),
    ).fetchone()["c"]
    if count:
        return
    for recipe in conn.execute("SELECT * FROM recipes").fetchall():
        hid = db.new_id()
        conn.execute(
            "INSERT INTO household_recipes (id, household_id, recipe_id, title, category, updated_at,"
            " updated_by_client) VALUES (?,?,?,?,?,?,?)",
            (hid, household_id, recipe["id"], recipe["title"], "regular", db.now(), client_id),
        )
        for ri in conn.execute(
            "SELECT ingredient_id, qty_base FROM recipe_ingredients WHERE recipe_id = ?", (recipe["id"],)
        ).fetchall():
            conn.execute(
                "INSERT INTO household_recipe_ingredients (household_recipe_id, ingredient_id, qty_base)"
                " VALUES (?,?,?)", (hid, ri["ingredient_id"], ri["qty_base"]),
            )
        db.bump_sync(conn, household_id, "household_recipes", hid, "upsert", client_id)


def recipe_requirements(conn, household_recipe_id: str, servings: int) -> list[dict[str, Any]]:
    hh_recipe = conn.execute(
        "SELECT * FROM household_recipes WHERE id = ? AND deleted_at IS NULL", (household_recipe_id,)
    ).fetchone()
    if not hh_recipe:
        raise HTTPException(status_code=404, detail="not found")
    base_servings = 2
    if hh_recipe["recipe_id"]:
        canon = conn.execute("SELECT base_servings FROM recipes WHERE id = ?", (hh_recipe["recipe_id"],)).fetchone()
        base_servings = canon["base_servings"] if canon else 2
    factor = servings / max(base_servings, 1)
    rows = conn.execute(
        "SELECT ri.ingredient_id, ri.qty_base, i.name_en AS name, i.base_unit"
        " FROM household_recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id"
        " WHERE ri.household_recipe_id = ?", (household_recipe_id,),
    ).fetchall()
    return [
        {"ingredient_id": r["ingredient_id"], "name": r["name"], "unit_base": r["base_unit"],
         "qty_base": round(r["qty_base"] * factor, 1)}
        for r in rows
    ]


def stock_map(conn, household_id: str) -> dict[str, float]:
    return {r["ingredient_id"]: r["qty_base"] for r in db.stock_rows(conn, household_id)}


def missing_for(requirements: list[dict[str, Any]], stock: dict[str, float]) -> list[dict[str, Any]]:
    out = []
    for req in requirements:
        have = stock.get(req["ingredient_id"], 0)
        if have + 1e-9 < req["qty_base"]:
            out.append({**req, "have_base": have, "short_base": round(req["qty_base"] - have, 1)})
    return out


def nutrition_for(conn, requirements: list[dict[str, Any]]) -> dict[str, Any]:
    totals: dict[str, float] = defaultdict(float)
    for req in requirements:
        row = conn.execute("SELECT nutrients_per_100 FROM ingredients WHERE id = ?", (req["ingredient_id"],)).fetchone()
        if not row:
            continue
        nutrients = json.loads(row["nutrients_per_100"] or "{}")
        for key, per_100 in nutrients.items():
            totals[key] += float(per_100) * req["qty_base"] / 100.0
    return {k: round(v, 1) for k, v in totals.items()}


def household_or_404(conn, table: str, row_id: str, household_id: str, columns: str = "*"):
    row = conn.execute(
        f"SELECT {columns} FROM {table} WHERE id = ? AND household_id = ? AND deleted_at IS NULL",
        (row_id, household_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return row


def apply_stock_change(conn, household_id: str, client_id: str, ingredient_id: str, op: str,
                       qty: float, reason: str, ref_id: str | None = None) -> dict[str, Any]:
    row = conn.execute(
        "SELECT * FROM stock_items WHERE household_id = ? AND ingredient_id = ? AND deleted_at IS NULL",
        (household_id, ingredient_id),
    ).fetchone()
    ing = conn.execute("SELECT name_en, base_unit, storage_place FROM ingredients WHERE id = ?", (ingredient_id,)).fetchone()
    if not ing:
        raise HTTPException(status_code=422, detail="unknown ingredient")
    before = row["qty_base"] if row else 0.0
    if op == "add":
        after = before + qty
    elif op == "remove":
        after = max(before - qty, 0.0)
    else:
        after = qty
    if after < 0 or after > 200_000:
        raise HTTPException(status_code=422, detail="quantity out of range")
    if row:
        conn.execute(
            "UPDATE stock_items SET qty_base = ?, version = version + 1, updated_at = ?,"
            " updated_by_client = ? WHERE id = ?",
            (after, db.now(), client_id, row["id"]),
        )
        item_id = row["id"]
    else:
        item_id = db.new_id()
        conn.execute(
            "INSERT INTO stock_items (id, household_id, ingredient_id, qty_base, location, updated_at,"
            " updated_by_client) VALUES (?,?,?,?,?,?,?)",
            (item_id, household_id, ingredient_id, after, ing["storage_place"] or "pantry", db.now(), client_id),
        )
    conn.execute(
        "INSERT INTO stock_events (id, household_id, stock_item_id, ingredient_id, delta, reason, ref_id,"
        " created_at) VALUES (?,?,?,?,?,?,?,?)",
        (db.new_id(), household_id, item_id, ingredient_id, after - before, reason, ref_id, db.now()),
    )
    db.bump_sync(conn, household_id, "stock_items", item_id, "upsert", client_id)
    return {"name": ing["name_en"], "unit_base": ing["base_unit"], "before": before, "after": after, "op": op,
            "qty_base": qty}


# --------------------------------------------------------------------------- profile


@app.get("/health")
async def health() -> dict[str, Any]:
    body: dict[str, Any] = {"status": "ok", "provider": PROVIDER, "model": OLLAMA_MODEL, "format": OLLAMA_FORMAT}
    if PROVIDER == "ollama":
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                tags = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                names = [m.get("name") for m in tags.json().get("models", [])]
                body["ollama"] = {"reachable": tags.status_code == 200,
                                  "model_present": any(OLLAMA_MODEL in (n or "") for n in names)}
        except Exception as exc:  # noqa: BLE001
            body["ollama"] = {"reachable": False, "error": type(exc).__name__}
    return body


@app.get("/api/me")
def me(ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        user = conn.execute("SELECT id, email, name FROM users WHERE id = ?", (ctx["user_id"],)).fetchone()
        house = conn.execute("SELECT * FROM households WHERE id = ?", (ctx["household_id"],)).fetchone()
        members = conn.execute(
            "SELECT m.id, m.age_group, m.label FROM household_members m WHERE m.household_id = ?"
            " AND m.deleted_at IS NULL ORDER BY m.age_group", (ctx["household_id"],),
        ).fetchall()
        cautions: dict[str, list[str]] = defaultdict(list)
        for row in conn.execute(
            "SELECT c.member_id, c.caution FROM member_cautions c JOIN household_members m"
            " ON m.id = c.member_id WHERE m.household_id = ?", (ctx["household_id"],),
        ).fetchall():
            cautions[row["member_id"]].append(row["caution"])
        return {
            "user": dict(user),
            "household": {"id": house["id"], "name": house["name"], "has_fridge": bool(house["has_fridge"]),
                          "language": house["language"], "version": house["version"]},
            "role": ctx["role"],
            "client_id": ctx["client_id"],
            "members": [{**dict(m), "cautions": cautions.get(m["id"], [])} for m in members],
        }
    finally:
        conn.close()


class HouseholdIn(BaseModel):
    name: str | None = None
    has_fridge: bool | None = None
    language: str | None = None


@app.patch("/api/household")
def patch_household(body: HouseholdIn, ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        fields, values = [], []
        if body.name is not None:
            fields.append("name = ?"); values.append(body.name[:80])
        if body.has_fridge is not None:
            fields.append("has_fridge = ?"); values.append(1 if body.has_fridge else 0)
        if body.language is not None:
            if body.language not in ("en", "hi", "hinglish"):
                raise HTTPException(status_code=422, detail="language must be en, hi or hinglish")
            fields.append("language = ?"); values.append(body.language)
        if not fields:
            raise HTTPException(status_code=422, detail="nothing to update")
        fields += ["version = version + 1", "updated_at = ?"]
        values += [db.now(), ctx["household_id"]]
        conn.execute(f"UPDATE households SET {', '.join(fields)} WHERE id = ?", values)
        db.bump_sync(conn, ctx["household_id"], "households", ctx["household_id"], "upsert", ctx["client_id"])
        conn.commit()
        return me(ctx)
    finally:
        conn.close()


class MemberIn(BaseModel):
    age_group: str
    label: str | None = None
    cautions: list[str] = []


@app.post("/api/members")
def add_member(body: MemberIn, ctx: dict = Depends(current)) -> dict[str, Any]:
    if ctx["role"] != "owner":
        raise HTTPException(status_code=403, detail="owner only")
    if body.age_group not in ("kid", "adult", "elderly"):
        raise HTTPException(status_code=422, detail="age_group must be kid, adult or elderly")
    bad = [c for c in body.cautions if c not in ("diabetes", "upset_stomach", "heart")]
    if bad:
        raise HTTPException(status_code=422, detail=f"unknown cautions: {bad}")
    conn = db.connect()
    try:
        mid = db.new_id()
        conn.execute(
            "INSERT INTO household_members (id, household_id, age_group, label, updated_at, updated_by_client)"
            " VALUES (?,?,?,?,?,?)",
            (mid, ctx["household_id"], body.age_group, body.label, db.now(), ctx["client_id"]),
        )
        for caution in set(body.cautions):
            conn.execute("INSERT INTO member_cautions (member_id, caution) VALUES (?,?)", (mid, caution))
        db.bump_sync(conn, ctx["household_id"], "household_members", mid, "upsert", ctx["client_id"])
        db.audit(conn, ctx["household_id"], ctx["user_id"], "member_added", {"age_group": body.age_group})
        conn.commit()
        return {"id": mid}
    finally:
        conn.close()


@app.delete("/api/members/{member_id}")
def delete_member(member_id: str, ctx: dict = Depends(current)) -> dict[str, str]:
    if ctx["role"] != "owner":
        raise HTTPException(status_code=403, detail="owner only")
    conn = db.connect()
    try:
        household_or_404(conn, "household_members", member_id, ctx["household_id"], "id")
        conn.execute(
            "UPDATE household_members SET deleted_at = ?, version = version + 1, updated_by_client = ?"
            " WHERE id = ?", (db.now(), ctx["client_id"], member_id),
        )
        db.bump_sync(conn, ctx["household_id"], "household_members", member_id, "delete", ctx["client_id"])
        db.audit(conn, ctx["household_id"], ctx["user_id"], "member_removed", {"member_id": member_id})
        conn.commit()
        return {"status": "deleted"}
    finally:
        conn.close()


# --------------------------------------------------------------------------- recipes and stock


@app.get("/api/ingredients")
def ingredients(ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        rows = conn.execute("SELECT * FROM ingredients ORDER BY name_en").fetchall()
        return {"ingredients": [
            {"id": r["id"], "name": r["name_en"], "name_hi": r["name_hi"],
             "aliases": json.loads(r["aliases"]), "category": r["category"], "base_unit": r["base_unit"],
             "grams_per_pc": r["grams_per_pc"], "storage_place": r["storage_place"],
             "shelf_life_days": r["shelf_life_days"], "nutrients_per_100": json.loads(r["nutrients_per_100"])}
            for r in rows
        ]}
    finally:
        conn.close()


@app.get("/api/recipes")
def recipes(ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        ensure_household_recipes(conn, ctx["household_id"], ctx["client_id"])
        conn.commit()
        rows = conn.execute(
            "SELECT hr.*, (SELECT COUNT(*) FROM household_recipe_ingredients x WHERE"
            " x.household_recipe_id = hr.id) AS ingredient_count FROM household_recipes hr"
            " WHERE hr.household_id = ? AND hr.deleted_at IS NULL ORDER BY hr.title",
            (ctx["household_id"],),
        ).fetchall()
        return {"recipes": [dict(r) for r in rows]}
    finally:
        conn.close()


@app.get("/api/recipes/{recipe_id}")
def recipe_detail(recipe_id: str, servings: int = 2, ctx: dict = Depends(current)) -> dict[str, Any]:
    if not 1 <= servings <= 20:
        raise HTTPException(status_code=422, detail="servings must be 1..20")
    conn = db.connect()
    try:
        ensure_household_recipes(conn, ctx["household_id"], ctx["client_id"])
        conn.commit()
        row = household_or_404(conn, "household_recipes", recipe_id, ctx["household_id"])
        reqs = recipe_requirements(conn, recipe_id, servings)
        stock = stock_map(conn, ctx["household_id"])
        return {
            "id": row["id"], "title": row["title"], "category": row["category"],
            "times_cooked": row["times_cooked"], "servings": servings,
            "ingredients": [{**r, "have_base": stock.get(r["ingredient_id"], 0),
                             "enough": stock.get(r["ingredient_id"], 0) >= r["qty_base"] - 1e-9} for r in reqs],
            "missing": missing_for(reqs, stock),
            "nutrition": nutrition_for(conn, reqs),
        }
    finally:
        conn.close()


@app.get("/api/stock")
def get_stock(ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        return {"household_id": ctx["household_id"], "stock": db.stock_rows(conn, ctx["household_id"])}
    finally:
        conn.close()


class StockAdjustIn(BaseModel):
    ingredient_id: str
    op: str = "add"
    qty_base: float


@app.post("/api/stock/adjust")
def adjust_stock(body: StockAdjustIn, ctx: dict = Depends(current)) -> dict[str, Any]:
    if body.op not in ("add", "remove", "set"):
        raise HTTPException(status_code=422, detail="op must be add, remove or set")
    if not (0 < body.qty_base <= 100_000):
        raise HTTPException(status_code=422, detail="quantity out of range")
    conn = db.connect()
    try:
        result = apply_stock_change(conn, ctx["household_id"], ctx["client_id"], body.ingredient_id,
                                    body.op, body.qty_base, "manual")
        conn.commit()
        return {"applied": result, "stock": db.stock_rows(conn, ctx["household_id"])}
    finally:
        conn.close()


# --------------------------------------------------------------------------- plan and shopping


class MealIn(BaseModel):
    meal_date: str
    slot: str
    household_recipe_id: str
    servings: int = 2


@app.get("/api/plan")
def get_plan(week_start: str | None = None, ctx: dict = Depends(current)) -> dict[str, Any]:
    start = monday_of(week_start)
    conn = db.connect()
    try:
        ensure_household_recipes(conn, ctx["household_id"], ctx["client_id"])
        plan_id = get_or_create_plan(conn, ctx["household_id"], start)
        conn.commit()
        meals = conn.execute(
            "SELECT pm.*, hr.title FROM planned_meals pm LEFT JOIN household_recipes hr"
            " ON hr.id = pm.household_recipe_id WHERE pm.plan_id = ? AND pm.deleted_at IS NULL"
            " ORDER BY pm.meal_date, CASE pm.slot WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 ELSE 3 END",
            (plan_id,),
        ).fetchall()
        stock = stock_map(conn, ctx["household_id"])
        out = []
        for meal in meals:
            reqs = recipe_requirements(conn, meal["household_recipe_id"], meal["servings"]) if meal["household_recipe_id"] else []
            out.append({**dict(meal), "nutrition": json.loads(meal["nutrition"] or "{}"),
                        "missing": missing_for(reqs, stock)})
        return {"week_start": start, "plan_id": plan_id, "meals": out}
    finally:
        conn.close()


@app.post("/api/plan/meals")
def add_meal(body: MealIn, ctx: dict = Depends(current)) -> dict[str, Any]:
    if body.slot not in ("breakfast", "lunch", "dinner"):
        raise HTTPException(status_code=422, detail="slot must be breakfast, lunch or dinner")
    try:
        datetime.strptime(body.meal_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="meal_date must be YYYY-MM-DD")
    if not 1 <= body.servings <= 20:
        raise HTTPException(status_code=422, detail="servings must be 1..20")
    conn = db.connect()
    try:
        ensure_household_recipes(conn, ctx["household_id"], ctx["client_id"])
        household_or_404(conn, "household_recipes", body.household_recipe_id, ctx["household_id"], "id")
        plan_id = get_or_create_plan(conn, ctx["household_id"], monday_of(body.meal_date))
        conn.execute(
            "DELETE FROM planned_meals WHERE plan_id = ? AND meal_date = ? AND slot = ?",
            (plan_id, body.meal_date, body.slot),
        )
        meal_id = db.new_id()
        reqs = recipe_requirements(conn, body.household_recipe_id, body.servings)
        conn.execute(
            "INSERT INTO planned_meals (id, plan_id, meal_date, slot, household_recipe_id, servings,"
            " status, missing_items, nutrition, updated_at, updated_by_client) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (meal_id, plan_id, body.meal_date, body.slot, body.household_recipe_id, body.servings, "planned",
             json.dumps([m["name"] for m in missing_for(reqs, stock_map(conn, ctx["household_id"]))]),
             json.dumps(nutrition_for(conn, reqs)), db.now(), ctx["client_id"]),
        )
        db.bump_sync(conn, ctx["household_id"], "planned_meals", meal_id, "upsert", ctx["client_id"])
        conn.commit()
        return {"id": meal_id, "plan_id": plan_id}
    finally:
        conn.close()


def _meal_ctx(conn, meal_id: str, household_id: str):
    row = conn.execute(
        "SELECT pm.*, mp.household_id FROM planned_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id"
        " WHERE pm.id = ? AND mp.household_id = ? AND pm.deleted_at IS NULL",
        (meal_id, household_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return row


@app.post("/api/plan/meals/{meal_id}/done")
def mark_done(meal_id: str, ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        meal = _meal_ctx(conn, meal_id, ctx["household_id"])
        if meal["status"] == "done":
            raise HTTPException(status_code=409, detail="meal already done")
        reqs = recipe_requirements(conn, meal["household_recipe_id"], meal["servings"])
        applied = []
        for req in reqs:
            applied.append(apply_stock_change(
                conn, ctx["household_id"], ctx["client_id"], req["ingredient_id"], "remove",
                req["qty_base"], "meal_done", meal_id,
            ))
        conn.execute(
            "UPDATE planned_meals SET status = 'done', nutrition = ?, missing_items = '[]',"
            " version = version + 1, updated_at = ?, updated_by_client = ? WHERE id = ?",
            (json.dumps(nutrition_for(conn, reqs)), db.now(), ctx["client_id"], meal_id),
        )
        if meal["household_recipe_id"]:
            conn.execute(
                "UPDATE household_recipes SET times_cooked = times_cooked + 1 WHERE id = ?",
                (meal["household_recipe_id"],),
            )
        db.bump_sync(conn, ctx["household_id"], "planned_meals", meal_id, "upsert", ctx["client_id"])
        db.audit(conn, ctx["household_id"], ctx["user_id"], "meal_done", {"meal_id": meal_id})
        conn.commit()
        return {"meal_id": meal_id, "status": "done", "deducted": applied,
                "stock": db.stock_rows(conn, ctx["household_id"])}
    finally:
        conn.close()


@app.post("/api/plan/meals/{meal_id}/skip")
def mark_skipped(meal_id: str, ctx: dict = Depends(current)) -> dict[str, str]:
    conn = db.connect()
    try:
        _meal_ctx(conn, meal_id, ctx["household_id"])
        conn.execute(
            "UPDATE planned_meals SET status = 'skipped', version = version + 1, updated_at = ?,"
            " updated_by_client = ? WHERE id = ?", (db.now(), ctx["client_id"], meal_id),
        )
        db.bump_sync(conn, ctx["household_id"], "planned_meals", meal_id, "upsert", ctx["client_id"])
        conn.commit()
        return {"meal_id": meal_id, "status": "skipped"}
    finally:
        conn.close()


@app.get("/api/plan/check")
def plan_check(week_start: str | None = None, ctx: dict = Depends(current)) -> dict[str, Any]:
    plan = get_plan(week_start, ctx)
    conn = db.connect()
    try:
        stock = stock_map(conn, ctx["household_id"])
        needs: dict[str, dict[str, Any]] = {}
        for meal in plan["meals"]:
            if meal["status"] != "planned" or not meal["household_recipe_id"]:
                continue
            for req in recipe_requirements(conn, meal["household_recipe_id"], meal["servings"]):
                slot = needs.setdefault(req["ingredient_id"], {"ingredient_id": req["ingredient_id"],
                                                                "name": req["name"], "unit_base": req["unit_base"],
                                                                "required_base": 0.0})
                slot["required_base"] = round(slot["required_base"] + req["qty_base"], 1)
        for need in needs.values():
            have = stock.get(need["ingredient_id"], 0)
            need["have_base"] = have
            need["short_base"] = round(max(need["required_base"] - have, 0), 1)
        return {"week_start": plan["week_start"], "meals": plan["meals"],
                "missing": [n for n in needs.values() if n["short_base"] > 0]}
    finally:
        conn.close()


class GenerateListIn(BaseModel):
    week_start: str | None = None


@app.post("/api/shopping-list/generate")
def generate_list(body: GenerateListIn, ctx: dict = Depends(current)) -> dict[str, Any]:
    check = plan_check(body.week_start, ctx)
    conn = db.connect()
    try:
        existing = conn.execute(
            "SELECT id FROM shopping_lists WHERE household_id = ? AND week_start = ?",
            (ctx["household_id"], check["week_start"]),
        ).fetchone()
        list_id = existing["id"] if existing else db.new_id()
        if not existing:
            conn.execute(
                "INSERT INTO shopping_lists (id, household_id, week_start, created_at) VALUES (?,?,?,?)",
                (list_id, ctx["household_id"], check["week_start"], db.now()),
            )
        for item in check["missing"]:
            conn.execute(
                "INSERT INTO shopping_list_items (id, list_id, ingredient_id, qty_base) VALUES (?,?,?,?)"
                " ON CONFLICT (list_id, ingredient_id) DO UPDATE SET qty_base = excluded.qty_base",
                (db.new_id(), list_id, item["ingredient_id"], item["short_base"]),
            )
        db.bump_sync(conn, ctx["household_id"], "shopping_lists", list_id, "upsert", ctx["client_id"])
        conn.commit()
        return {"list_id": list_id, "week_start": check["week_start"], "items": check["missing"],
                "note": "Swiggy cart handoff is not wired: MCP client id approval is pending"}
    finally:
        conn.close()


@app.get("/api/shopping-list")
def shopping_list(week_start: str | None = None, ctx: dict = Depends(current)) -> dict[str, Any]:
    start = monday_of(week_start)
    conn = db.connect()
    try:
        row = conn.execute(
            "SELECT id FROM shopping_lists WHERE household_id = ? AND week_start = ?",
            (ctx["household_id"], start),
        ).fetchone()
        if not row:
            return {"week_start": start, "items": []}
        items = conn.execute(
            "SELECT sli.id, sli.ingredient_id, i.name_en AS name, sli.qty_base, i.base_unit,"
            " sli.in_swiggy_cart FROM shopping_list_items sli JOIN ingredients i ON i.id = sli.ingredient_id"
            " WHERE sli.list_id = ? ORDER BY i.name_en", (row["id"],),
        ).fetchall()
        return {"week_start": start, "items": [dict(i) for i in items]}
    finally:
        conn.close()


@app.get("/api/sync")
def sync(since: int = 0, ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        rows = conn.execute(
            "SELECT seq, table_name, row_id, op, created_at FROM sync_log"
            " WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT 500",
            (ctx["household_id"], since),
        ).fetchall()
        return {"since": since, "changes": [dict(r) for r in rows],
                "latest_seq": rows[-1]["seq"] if rows else since}
    finally:
        conn.close()


# --------------------------------------------------------------------------- agent


RATE: dict[str, deque] = defaultdict(deque)
INJECTION_PATTERNS = [
    r"ignore (all |any )?(previous|prior|above) instructions",
    r"disregard (all |any )?(previous|prior|above)",
    r"reveal (your |the )?(system prompt|instructions)",
    r"you are now", r"system prompt", r"developer message",
]
ZERO_WIDTH = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060\ufeff\U000E0000-\U000E007F]")


def rate_limited(household_id: str) -> bool:
    now_ts = time.time()
    bucket = RATE[household_id]
    while bucket and now_ts - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_EXPENSIVE_PER_MIN:
        return True
    bucket.append(now_ts)
    return False


def build_context(conn, household_id: str, mode: str) -> str:
    house = conn.execute("SELECT * FROM households WHERE id = ?", (household_id,)).fetchone()
    members = conn.execute(
        "SELECT age_group FROM household_members WHERE household_id = ? AND deleted_at IS NULL",
        (household_id,),
    ).fetchall()
    cautions = [r["caution"] for r in conn.execute(
        "SELECT DISTINCT c.caution FROM member_cautions c JOIN household_members m ON m.id = c.member_id"
        " WHERE m.household_id = ? AND m.deleted_at IS NULL", (household_id,),
    ).fetchall()]
    stock = db.stock_rows(conn, household_id)
    aliases = [
        {"ingredient_id": r["id"], "names": json.loads(r["aliases"])}
        for r in conn.execute("SELECT id, aliases FROM ingredients").fetchall()
    ]
    recs = conn.execute(
        "SELECT id, title FROM household_recipes WHERE household_id = ? AND deleted_at IS NULL",
        (household_id,),
    ).fetchall()
    return "\n".join([
        "CONTEXT (server-generated, trusted):",
        f"- mode: {mode}",
        "- language_hint: hi-en",
        "- household: " + json.dumps({
            "members": [{"age_group": m["age_group"]} for m in members],
            "cautions": cautions,
            "has_fridge": bool(house["has_fridge"]),
        }, ensure_ascii=False),
        "- stock: " + json.dumps([
            {"ingredient_id": s["ingredient_id"], "name": s["name"], "qty_base": s["qty_base"],
             "unit_base": s["unit_base"], "location": s["location"], "is_estimate": bool(s["is_estimate"])}
            for s in stock
        ], ensure_ascii=False),
        "- recipes: " + json.dumps([{"household_recipe_id": r["id"], "title": r["title"]} for r in recs],
                                   ensure_ascii=False),
        "- ingredient_aliases: " + json.dumps(aliases, ensure_ascii=False),
        f"- today: {date.today().isoformat()}",
    ])


async def call_ollama(user_text: str) -> tuple[str, dict[str, Any]]:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user_text}],
        "stream": False,
        "format": SCHEMA if OLLAMA_FORMAT == "schema" else "json",
        "options": {"temperature": 0.2, "num_ctx": 8192},
    }
    started = time.time()
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
        if resp.status_code == 400:
            payload["format"] = "json"
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
        resp.raise_for_status()
        body = resp.json()
    return (body.get("message") or {}).get("content", ""), {
        "model": body.get("model", OLLAMA_MODEL),
        "elapsed_ms": int((time.time() - started) * 1000),
        "eval_count": body.get("eval_count"),
    }


def extract_json(text: str) -> str:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in model output")
    return text[start:end + 1]


def normalize(parsed: dict[str, Any]) -> dict[str, Any]:
    parsed.setdefault("mode", "chat")
    if parsed["mode"] not in ("chat", "plan", "cart"):
        parsed["mode"] = "chat"
    for key, default in (("message", ""), ("proposal", None), ("unmatched", []), ("warnings", []),
                         ("needs_clarification", None), ("injection_suspected", False)):
        parsed.setdefault(key, default)
    proposal = parsed["proposal"]
    if isinstance(proposal, dict):
        if proposal.get("intent") not in ("edit_plan", "update_stock", "add_recipe", "set_category", "add_to_cart"):
            proposal["intent"] = "update_stock"
        proposal.setdefault("plan_changes", [])
        proposal.setdefault("recipe", None)
        items = proposal.get("items") or []
        for item in items:
            item.setdefault("op", "add")
            item.setdefault("note", None)
            try:
                item["qty_base"] = float(item.get("qty_base"))
            except (TypeError, ValueError):
                item["qty_base"] = 0.0
        proposal["items"] = items
    elif proposal is not None:
        parsed["proposal"] = None
    return parsed


def sanitize_message(msg: str) -> str:
    msg = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", msg)
    msg = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", msg)
    msg = re.sub(r"https?://\S+", "", msg)
    return msg.replace("**", "").replace("`", "").strip()[:MESSAGE_MAX_CHARS]


class ChatIn(BaseModel):
    text: str
    mode: str = "chat"
    stt_engine: str = "typed"
    stt_confidence: float = 1.0


@app.post("/api/chat")
async def chat(body: ChatIn, ctx: dict = Depends(current)) -> JSONResponse:
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="text is empty")
    if len(body.text) > INPUT_MAX_CHARS:
        raise HTTPException(status_code=413, detail=f"text exceeds {INPUT_MAX_CHARS} characters")
    if rate_limited(ctx["household_id"]):
        raise HTTPException(status_code=429, detail="slow down: expensive call rate limit")
    mode = body.mode if body.mode in ("chat", "plan", "cart") else "chat"

    text = ZERO_WIDTH.sub("", unicodedata.normalize("NFKC", body.text))
    flagged = [p for p in INJECTION_PATTERNS if re.search(p, text, re.IGNORECASE)]
    conn = db.connect()
    try:
        user_text = build_context(conn, ctx["household_id"], mode) + "\n\nUSER_DATA_TO_PROCESS:\n" + (
            f'<transcript confidence="{min(max(body.stt_confidence, 0), 1):.2f}" engine="{body.stt_engine}">'
            f"{text}</transcript>"
        )
        started = time.time()
        parsed, attempts, error = None, 0, ""
        meta: dict[str, Any] = {}
        while attempts < 2 and parsed is None:
            attempts += 1
            try:
                if PROVIDER == "stub":
                    content, meta = json.dumps({
                        "mode": mode, "message": "stub", "proposal": None, "unmatched": [], "warnings": [],
                        "needs_clarification": None, "injection_suspected": False,
                    }), {"model": "stub", "elapsed_ms": 0, "eval_count": 0}
                else:
                    content, meta = await call_ollama(user_text)
                parsed = normalize(json.loads(extract_json(content)))
                jsonschema.validate(parsed, SCHEMA)
            except (ValueError, jsonschema.ValidationError) as exc:
                error, parsed = str(exc)[:300], None
            except httpx.HTTPError as exc:
                return JSONResponse(status_code=503, content={
                    "error": "model_unreachable",
                    "detail": f"{type(exc).__name__}: is Ollama running with {OLLAMA_MODEL} pulled?",
                })
        if parsed is None:
            return JSONResponse(status_code=422, content={
                "error": "invalid_model_output", "detail": error, "attempts": attempts,
            })

        stock = stock_map(conn, ctx["household_id"])
        known = {r["id"]: r for r in conn.execute("SELECT * FROM ingredients").fetchall()}
        proposal = parsed.get("proposal")
        items: list[dict[str, Any]] = []
        unmatched = list(parsed.get("unmatched") or [])
        warnings = list(parsed.get("warnings") or [])
        if proposal:
            for item in (proposal.get("items") or [])[:MAX_ITEMS]:
                meta_ing = known.get(str(item.get("ingredient_id", "")))
                if not meta_ing:
                    unmatched.append({"raw_name": str(item.get("ingredient_id")), "reason": "unknown ingredient id"})
                    continue
                qty = float(item["qty_base"])
                if qty <= 0 or qty > 100_000:
                    warnings.append(f"rejected quantity for {meta_ing['name_en']}: {qty}")
                    continue
                before = stock.get(meta_ing["id"], 0)
                after = before + qty if item["op"] == "add" else max(before - qty, 0) if item["op"] == "remove" else qty
                items.append({**item, "name": meta_ing["name_en"], "unit_base": meta_ing["base_unit"],
                              "before": before, "after": after})
            proposal["items"] = items
        if flagged:
            warnings.append("input matched injection screening patterns; treated as data")
            parsed["injection_suspected"] = True

        proposal_id = None
        if proposal and (items or proposal.get("plan_changes") or proposal.get("recipe")):
            proposal_id = db.new_id()
            conn.execute(
                "INSERT INTO pending_actions (id, household_id, client_id, intent, transcript, stt_engine,"
                " stt_confidence, payload, status, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (proposal_id, ctx["household_id"], ctx["client_id"], proposal.get("intent"), text[:INPUT_MAX_CHARS],
                 body.stt_engine, body.stt_confidence, json.dumps(proposal, ensure_ascii=False), "pending",
                 time.time() + PENDING_TTL_MIN * 60, db.now()),
            )
            db.audit(conn, ctx["household_id"], ctx["user_id"], "proposal_created",
                     {"proposal_id": proposal_id, "intent": proposal.get("intent")})
            conn.commit()

        return JSONResponse({
            "message": sanitize_message(str(parsed.get("message", ""))),
            "proposal_id": proposal_id,
            "intent": proposal.get("intent") if proposal else None,
            "items": items,
            "plan_changes": proposal.get("plan_changes") if proposal else [],
            "recipe": proposal.get("recipe") if proposal else None,
            "unmatched": unmatched,
            "warnings": list(dict.fromkeys(warnings)),
            "needs_clarification": parsed.get("needs_clarification"),
            "injection_suspected": bool(parsed.get("injection_suspected")),
            "mode": parsed.get("mode", mode),
            "attempts": attempts,
            "timing": meta,
            "elapsed_ms": int((time.time() - started) * 1000),
        })
    finally:
        conn.close()


class ConfirmIn(BaseModel):
    proposal_id: str


@app.post("/api/confirm")
def confirm(body: ConfirmIn, ctx: dict = Depends(current)) -> dict[str, Any]:
    conn = db.connect()
    try:
        action = conn.execute(
            "SELECT * FROM pending_actions WHERE id = ? AND household_id = ? AND client_id = ?",
            (body.proposal_id, ctx["household_id"], ctx["client_id"]),
        ).fetchone()
        if not action or action["status"] != "pending":
            raise HTTPException(status_code=404, detail="not found")
        if time.time() > action["expires_at"]:
            conn.execute("UPDATE pending_actions SET status = 'expired' WHERE id = ?", (body.proposal_id,))
            conn.commit()
            raise HTTPException(status_code=410, detail="proposal expired")
        payload = json.loads(action["payload"])
        applied = []
        if payload.get("intent") != "add_to_cart":
            for item in payload.get("items") or []:
                applied.append(apply_stock_change(
                    conn, ctx["household_id"], ctx["client_id"], item["ingredient_id"], item["op"],
                    float(item["qty_base"]), "manual", body.proposal_id,
                ))
        for change in payload.get("plan_changes") or []:
            if not change.get("household_recipe_id"):
                continue
            try:
                add_meal(MealIn(meal_date=change["meal_date"], slot=change["slot"],
                                household_recipe_id=change["household_recipe_id"],
                                servings=int(change.get("servings") or 2)), ctx)
            except HTTPException:
                applied.append({"skipped_plan_change": change})
        recipe = payload.get("recipe")
        if recipe and recipe.get("title"):
            rh = db.new_id()
            conn.execute(
                "INSERT INTO household_recipes (id, household_id, title, category, updated_at, updated_by_client)"
                " VALUES (?,?,?,?,?,?)",
                (rh, ctx["household_id"], str(recipe["title"])[:120], "irregular", db.now(), ctx["client_id"]),
            )
            for ing in recipe.get("ingredients") or []:
                if ing.get("ingredient_id") in {r["id"] for r in conn.execute("SELECT id FROM ingredients")}:
                    conn.execute(
                        "INSERT OR REPLACE INTO household_recipe_ingredients (household_recipe_id,"
                        " ingredient_id, qty_base) VALUES (?,?,?)",
                        (rh, ing["ingredient_id"], float(ing["qty_base"])),
                    )
            db.bump_sync(conn, ctx["household_id"], "household_recipes", rh, "upsert", ctx["client_id"])
            applied.append({"recipe_added": rh, "title": recipe["title"]})
        conn.execute(
            "UPDATE pending_actions SET status = 'confirmed' WHERE id = ?", (body.proposal_id,),
        )
        db.audit(conn, ctx["household_id"], ctx["user_id"], "proposal_confirmed",
                 {"proposal_id": body.proposal_id, "intent": action["intent"]})
        conn.commit()
        return {"applied": applied, "stock": db.stock_rows(conn, ctx["household_id"])}
    finally:
        conn.close()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(Path(__file__).parent / "static" / "index.html")
