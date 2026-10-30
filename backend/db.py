"""SQLite store for the Mast Meals test harness.

Mirrors the Postgres schema in spec section 5 for the tables the baseline loop needs.
SQLite stands in because no Postgres server is installed here; column names, UUID keys and
the sync fields (version, updated_at, updated_by_client, deleted_at) match the spec so the
queries port over. See docs/gap-analysis.md for what is still missing.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any

DB_PATH = Path(os.getenv("DB_PATH", Path(__file__).parent / "mastmeals.db"))

SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, google_sub TEXT UNIQUE, email TEXT, name TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, has_fridge INTEGER NOT NULL DEFAULT 1,
  language TEXT NOT NULL DEFAULT 'en', version INTEGER NOT NULL DEFAULT 1, updated_at TEXT
);

CREATE TABLE IF NOT EXISTS household_users (
  user_id TEXT NOT NULL, household_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (user_id, household_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, label TEXT, last_pulled_seq INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS household_members (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, age_group TEXT NOT NULL, label TEXT,
  version INTEGER NOT NULL DEFAULT 1, updated_at TEXT, updated_by_client TEXT, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS member_cautions (
  member_id TEXT NOT NULL, caution TEXT NOT NULL, PRIMARY KEY (member_id, caution)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_hi TEXT, aliases TEXT NOT NULL DEFAULT '[]',
  category TEXT, base_unit TEXT NOT NULL, grams_per_pc REAL, storage_place TEXT,
  shelf_life_days INTEGER, nutrients_per_100 TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, slots TEXT NOT NULL DEFAULT '[]',
  base_servings INTEGER NOT NULL DEFAULT 2, graph_node_id TEXT
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, qty_base REAL NOT NULL,
  optional INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (recipe_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS household_recipes (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, recipe_id TEXT, title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'regular', times_cooked INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1, updated_at TEXT, updated_by_client TEXT, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS household_recipe_ingredients (
  household_recipe_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, qty_base REAL NOT NULL,
  PRIMARY KEY (household_recipe_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS stock_items (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, ingredient_id TEXT NOT NULL,
  qty_base REAL NOT NULL DEFAULT 0 CHECK (qty_base >= 0), location TEXT NOT NULL DEFAULT 'pantry',
  expiry TEXT, is_estimate INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT, updated_by_client TEXT, deleted_at TEXT,
  UNIQUE (household_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS stock_events (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, stock_item_id TEXT, ingredient_id TEXT NOT NULL,
  delta REAL NOT NULL, reason TEXT NOT NULL, ref_id TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, week_start TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, UNIQUE (household_id, week_start)
);

CREATE TABLE IF NOT EXISTS planned_meals (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, meal_date TEXT NOT NULL, slot TEXT NOT NULL,
  household_recipe_id TEXT, servings INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'planned', missing_items TEXT NOT NULL DEFAULT '[]',
  nutrition TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1, updated_at TEXT,
  updated_by_client TEXT, deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, week_start TEXT NOT NULL, created_at TEXT
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id TEXT PRIMARY KEY, list_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, qty_base REAL NOT NULL,
  in_swiggy_cart INTEGER NOT NULL DEFAULT 0, UNIQUE (list_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL, client_id TEXT NOT NULL, intent TEXT,
  transcript TEXT, stt_engine TEXT, stt_confidence REAL, payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', expires_at REAL NOT NULL, created_at TEXT
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT NOT NULL, family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, expires_at REAL NOT NULL, used_at REAL, revoked_at REAL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, household_id TEXT NOT NULL, table_name TEXT NOT NULL,
  row_id TEXT NOT NULL, op TEXT NOT NULL, client_id TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, household_id TEXT, user_id TEXT, action TEXT NOT NULL, meta TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_household_seq ON sync_log (household_id, seq);
CREATE INDEX IF NOT EXISTS idx_stock_household ON stock_items (household_id);
CREATE INDEX IF NOT EXISTS idx_meals_plan ON planned_meals (plan_id);
"""


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def new_id() -> str:
    return str(uuid.uuid4())


def export_id(name: str) -> str:
    """Deterministic id for reference data so seeds are idempotent and stable."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"mastmeals/{name}"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init() -> None:
    conn = connect()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
    seed_reference()


INGREDIENTS = [
    # name, hindi, aliases, category, unit, grams_per_pc, storage, shelf_life_days
    ("aloo", "आलू", ["aloo", "potato", "potatoes", "alu"], "vegetable", "g", 120, "pantry", 30),
    ("atta", "आटा", ["atta", "wheat flour", "flour"], "grain", "g", None, "pantry", 90),
    ("dahi", "दही", ["dahi", "curd", "yogurt"], "dairy", "ml", None, "fridge", 4),
    ("chawal", "चावल", ["chawal", "rice", "basmati"], "grain", "g", None, "pantry", 180),
    ("dal", "दाल", ["dal", "daal", "toor dal", "lentils"], "pulse", "g", None, "pantry", 120),
    ("oil", "तेल", ["oil", "tel", "mustard oil"], "fat", "ml", None, "pantry", 180),
    ("namak", "नमक", ["namak", "salt"], "spice", "g", None, "pantry", 365),
    ("pyaz", "प्याज़", ["pyaz", "onion", "onions"], "vegetable", "g", 110, "pantry", 21),
    ("tamatar", "टमाटर", ["tamatar", "tomato", "tomatoes"], "vegetable", "g", 90, "fridge", 7),
    ("paneer", "पनीर", ["paneer", "cottage cheese"], "dairy", "g", None, "fridge", 4),
    ("doodh", "दूध", ["doodh", "milk"], "dairy", "ml", None, "fridge", 3),
    ("jeera", "जीरा", ["jeera", "cumin"], "spice", "g", None, "pantry", 365),
]

NUTRIENTS = {
    "aloo": {"kcal": 77, "protein_g": 2, "carbs_g": 17, "fat_g": 0.1, "sodium_mg": 6},
    "atta": {"kcal": 364, "protein_g": 10, "carbs_g": 76, "fat_g": 1, "sodium_mg": 2},
    "dahi": {"kcal": 61, "protein_g": 3.5, "carbs_g": 4.7, "fat_g": 3.3, "sodium_mg": 46},
    "chawal": {"kcal": 365, "protein_g": 7, "carbs_g": 80, "fat_g": 0.7, "sodium_mg": 5},
    "dal": {"kcal": 343, "protein_g": 22, "carbs_g": 63, "fat_g": 1.6, "sodium_mg": 6},
    "oil": {"kcal": 884, "protein_g": 0, "carbs_g": 0, "fat_g": 100, "sodium_mg": 0},
    "namak": {"kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "sodium_mg": 38758},
    "paneer": {"kcal": 265, "protein_g": 18, "carbs_g": 3.4, "fat_g": 20, "sodium_mg": 22},
}

RECIPES = [
    ("Aloo Paratha", ["breakfast"], 2, [("aloo", 300), ("atta", 250), ("oil", 30), ("namak", 6), ("jeera", 4)]),
    ("Dal Chawal", ["lunch", "dinner"], 2, [("dal", 150), ("chawal", 180), ("oil", 20), ("namak", 6), ("tamatar", 100)]),
    ("Paneer Bhurji", ["lunch", "dinner"], 2, [("paneer", 200), ("pyaz", 100), ("tamatar", 80), ("oil", 25), ("namak", 5)]),
    ("Dahi Chawal", ["lunch"], 2, [("dahi", 200), ("chawal", 150), ("namak", 3)]),
]


def seed_reference() -> None:
    conn = connect()
    try:
        for name, hindi, aliases, category, unit, gpp, storage, shelf in INGREDIENTS:
            iid = export_id(name)
            conn.execute(
                "INSERT OR IGNORE INTO ingredients (id, name_en, name_hi, aliases, category, base_unit,"
                " grams_per_pc, storage_place, shelf_life_days, nutrients_per_100)"
                " VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    iid, name, hindi, json.dumps(aliases, ensure_ascii=False), category, unit, gpp,
                    storage, shelf, json.dumps(NUTRIENTS.get(name, {})),
                ),
            )
        for title, slots, base_servings, ings in RECIPES:
            rid = export_id(f"recipe/{title}")
            conn.execute(
                "INSERT OR IGNORE INTO recipes (id, title, slots, base_servings, graph_node_id)"
                " VALUES (?,?,?,?,?)",
                (rid, title, json.dumps(slots), base_servings, f"graph:{title.lower().replace(' ', '-')}"),
            )
            for ing_name, qty in ings:
                conn.execute(
                    "INSERT OR IGNORE INTO recipe_ingredients (recipe_id, ingredient_id, qty_base)"
                    " VALUES (?,?,?)",
                    (rid, export_id(ing_name), qty),
                )
        conn.commit()
    finally:
        conn.close()


def seed_stock(conn: sqlite3.Connection, household_id: str) -> None:
    """Demo-only starting stock. The spec starts a household empty; DEV_SEED_STOCK turns this on."""
    if os.getenv("DEV_SEED_STOCK", "true").strip().lower() not in ("1", "true", "yes"):
        return
    seed = {"aloo": 1200, "atta": 1500, "dal": 600, "chawal": 900, "oil": 400, "namak": 400}
    for name, qty in seed.items():
        ing = export_id(name)
        location = conn.execute(
            "SELECT storage_place FROM ingredients WHERE id = ?", (ing,)
        ).fetchone()["storage_place"]
        conn.execute(
            "INSERT OR IGNORE INTO stock_items (id, household_id, ingredient_id, qty_base, location,"
            " updated_at) VALUES (?,?,?,?,?,?)",
            (new_id(), household_id, ing, qty, location, now()),
        )
        conn.execute(
            "INSERT INTO stock_events (id, household_id, ingredient_id, delta, reason, created_at)"
            " VALUES (?,?,?,?,?,?)",
            (new_id(), household_id, ing, qty, "purchase", now()),
        )


def create_household(conn: sqlite3.Connection, user_id: str, name: str, client_id: str) -> str:
    hid = new_id()
    conn.execute(
        "INSERT INTO households (id, name, has_fridge, language, version, updated_at)"
        " VALUES (?,?,?,?,?,?)",
        (hid, name, 1, "en", 1, now()),
    )
    conn.execute(
        "INSERT INTO household_users (user_id, household_id, role) VALUES (?,?,?)",
        (user_id, hid, "owner"),
    )
    # The calling login handler registers the client row for this device.
    for age_group, label in (("adult", "A"), ("adult", "B"), ("kid", "C")):
        mid = new_id()
        conn.execute(
            "INSERT INTO household_members (id, household_id, age_group, label, updated_at)"
            " VALUES (?,?,?,?,?)",
            (mid, hid, age_group, label, now()),
        )
    seed_stock(conn, hid)
    conn.commit()
    return hid


def bump_sync(
    conn: sqlite3.Connection, household_id: str, table: str, row_id: str, op: str, client_id: str
) -> None:
    conn.execute(
        "INSERT INTO sync_log (household_id, table_name, row_id, op, client_id, created_at)"
        " VALUES (?,?,?,?,?,?)",
        (household_id, table, row_id, op, client_id, now()),
    )


def audit(
    conn: sqlite3.Connection, household_id: str | None, user_id: str | None, action: str, meta: Any = None
) -> None:
    conn.execute(
        "INSERT INTO audit_log (id, household_id, user_id, action, meta, created_at) VALUES (?,?,?,?,?,?)",
        (new_id(), household_id, user_id, action, json.dumps(meta or {}, ensure_ascii=False), now()),
    )


def stock_rows(conn: sqlite3.Connection, household_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT s.ingredient_id, i.name_en AS name, s.qty_base, i.base_unit AS unit_base, s.location,"
        " s.is_estimate, s.expiry, s.version FROM stock_items s JOIN ingredients i ON i.id = s.ingredient_id"
        " WHERE s.household_id = ? AND s.deleted_at IS NULL ORDER BY i.name_en",
        (household_id,),
    ).fetchall()
    return [dict(r) for r in rows]
