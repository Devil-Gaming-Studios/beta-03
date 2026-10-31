"""Query layer over the Kuzu recipe graph.

Every method that returns recipes or ingredients takes a `diet` argument and applies it IN CODE
(Cypher WHERE clauses), before anything reaches an LLM. This is the strict veg/non-veg
filter from the plan: it is not a prompt instruction.

    diet = "veg"       -> veg_safe = 1 only (ingredients say veg, label does not say egg or
                          non-veg, no maybe-egg items, parsed correctly). Unknown = excluded.
    diet = "egg"       -> veg and egg recipes, never non-veg
    diet = "non_veg"   -> everything

Usage:
    g = RecipeGraph("data/graph/recipes.kuzu")
    g.cookable(stock_ids, diet="veg", max_missing=2, beginner=True)
"""
from __future__ import annotations

import json
from collections import Counter
from typing import Iterable

import kuzu

DIETS = {"veg", "egg", "non_veg"}
REQUIRED_KINDS = ["measured", "count", "unmeasured"]
DEFAULT_SERVINGS = 4


def _diet_clause(diet: str, alias: str = "r") -> str:
    if diet not in DIETS:
        raise ValueError(f"diet must be one of {sorted(DIETS)}, got {diet!r}")
    return {"veg": f"{alias}.veg_safe = 1", "egg": f"{alias}.egg_safe = 1", "non_veg": "true"}[diet]


class RecipeGraph:
    def __init__(self, db_path: str, read_only: bool = True):
        self.db = kuzu.Database(db_path, read_only=read_only)
        self.conn = kuzu.Connection(self.db)
        self._n_recipes = self.rows("MATCH (r:Recipe) RETURN count(*)")[0][0]

    # -- helpers ----------------------------------------------------------
    def rows(self, query: str, params: dict | None = None) -> list[list]:
        res = self.conn.execute(query, params or {})
        out = []
        while res.has_next():
            out.append(res.get_next())
        return out

    def ubiquitous_ids(self, share: float = 0.20) -> set[str]:
        rows = self.rows("MATCH (i:Ingredient) WHERE i.recipe_count > $n RETURN i.id",
                         {"n": int(share * self._n_recipes)})
        return {r[0] for r in rows}

    def ingredient_ids_for(self, names: Iterable[str]) -> dict[str, str | None]:
        """Map free-text names (from stock, chat or OCR) to ingredient ids: exact name, then alias."""
        out: dict[str, str | None] = {}
        for n in names:
            key = n.strip().lower()
            hit = self.rows("MATCH (i:Ingredient) WHERE i.name_en = $n RETURN i.id LIMIT 1", {"n": key})
            if not hit:
                hit = self.rows(
                    "MATCH (i:Ingredient) WHERE i.aliases CONTAINS $q "
                    "RETURN i.id ORDER BY i.recipe_count DESC LIMIT 1", {"q": json.dumps(key)})
            out[n] = hit[0][0] if hit else None
        return out

    # -- recipe search ----------------------------------------------------
    def find_recipes(self, diet: str, text: str | None = None, cuisine: str | None = None,
                     course: str | None = None, max_total_min: int | None = None,
                     beginner: bool = False, tag: str | None = None, limit: int = 20) -> list[dict]:
        where = [_diet_clause(diet), "r.parsed_ok = 1"]
        params: dict = {"lim": limit}
        if text:
            where.append("lower(r.title) CONTAINS $text")
            params["text"] = text.lower()
        if cuisine:
            where.append("r.cuisine = $cuisine")
            params["cuisine"] = cuisine
        if course:
            where.append("r.course = $course")
            params["course"] = course
        if max_total_min:
            where.append("r.total_min <= $mt")
            params["mt"] = max_total_min
        if beginner:
            where.append("r.difficulty = 'beginner'")
        if tag:
            where.append("r.tags CONTAINS $tag")
            params["tag"] = tag
        q = ("MATCH (r:Recipe) WHERE " + " AND ".join(where) +
             " RETURN r.id, r.title, r.cuisine, r.course, r.total_min, r.difficulty, r.diet_class "
             "ORDER BY r.title LIMIT $lim")
        cols = ["id", "title", "cuisine", "course", "total_min", "difficulty", "diet_class"]
        return [dict(zip(cols, r)) for r in self.rows(q, params)]

    # -- quantities --------------------------------------------------------
    def required_ingredients(self, recipe_id: str, servings: int | None = None) -> list[dict]:
        """Ingredients of a recipe with quantities scaled to `servings` (3 in the plan: scaling)."""
        head = self.rows("MATCH (r:Recipe {id: $id}) RETURN r.servings", {"id": recipe_id})
        if not head:
            return []
        base = head[0][0] or DEFAULT_SERVINGS
        factor = (servings / base) if servings else 1.0
        q = ("MATCH (r:Recipe {id: $id})-[u:USES]->(i:Ingredient) "
             "RETURN i.id, i.name_en, u.qty_base, u.base_unit, u.qty_kind, u.is_optional, u.raw_line")
        out = []
        for iid, name, qb, bu, kind, opt, raw in self.rows(q, {"id": recipe_id}):
            out.append({"ingredient_id": iid, "name": name, "qty_base": None if qb is None else round(qb * factor, 2),
                        "base_unit": bu, "qty_kind": kind, "optional": bool(opt), "raw": raw})
        return out

    # -- what can I cook from stock ---------------------------------------
    def cookable(self, stock_ids: Iterable[str], diet: str, max_missing: int = 2,
                 beginner: bool = False, limit: int = 20) -> list[dict]:
        stock = set(stock_ids)
        where = [_diet_clause(diet), "r.parsed_ok = 1", "u.is_optional = 0",
                 "u.qty_kind IN $kinds"]
        if beginner:
            where.append("r.difficulty = 'beginner'")
        q = ("MATCH (r:Recipe)-[u:USES]->(i:Ingredient) WHERE " + " AND ".join(where) +
             " RETURN r.id, r.title, r.total_min, r.difficulty, collect(i.id)")
        out = []
        for rid, title, tmin, diff, req in self.rows(q, {"kinds": REQUIRED_KINDS}):
            missing = [x for x in req if x not in stock]
            if len(missing) <= max_missing and req:
                out.append({"id": rid, "title": title, "total_min": tmin, "difficulty": diff,
                            "required": len(req), "missing": missing})
        out.sort(key=lambda d: (len(d["missing"]), -d["required"], d["title"]))
        return out[:limit]

    # -- similarity and "missing from your recipe" flags (plan 3.1) -------
    def similar(self, recipe_id: str, diet: str, k: int = 5) -> list[dict]:
        q = ("MATCH (a:Recipe {id: $id})-[s:SIMILAR]->(r:Recipe) WHERE " + _diet_clause(diet) +
             " RETURN r.id, r.title, s.jaccard, s.shared ORDER BY s.jaccard DESC LIMIT $k")
        return [dict(zip(["id", "title", "jaccard", "shared"], r)) for r in self.rows(q, {"id": recipe_id, "k": k})]

    def missing_vs_similar(self, ingredient_ids: Iterable[str], diet: str, k: int = 5,
                           min_share: float = 0.6, candidate_pool: int = 300) -> dict:
        """A user typed a recipe: find the closest canonical recipes by ingredient overlap and
        flag ingredients most of them have that the user's list lacks. Suggestions only."""
        mine = set(ingredient_ids)
        ubiq = self.ubiquitous_ids()
        key = mine - ubiq
        if len(key) < 2:
            return {"neighbours": [], "flags": []}
        cand = self.rows(
            "MATCH (r:Recipe)-[:USES]->(i:Ingredient) WHERE i.id IN $ids AND r.parsed_ok = 1 AND "
            + _diet_clause(diet) + " RETURN r.id, count(i) AS c ORDER BY c DESC LIMIT $n",
            {"ids": list(key), "n": candidate_pool})
        if not cand:
            return {"neighbours": [], "flags": []}
        rids = [c[0] for c in cand]
        sets: dict[str, set] = {}
        for rid, iid in self.rows("MATCH (r:Recipe)-[:USES]->(i:Ingredient) WHERE r.id IN $r RETURN r.id, i.id", {"r": rids}):
            sets.setdefault(rid, set()).add(iid)
        scored = []
        for rid, s in sets.items():
            sk = s - ubiq
            inter = len(sk & key)
            if inter >= 2:
                scored.append((inter / len(sk | key), rid))
        scored.sort(reverse=True)
        top = scored[:k]
        if not top:
            return {"neighbours": [], "flags": []}
        titles = dict(self.rows("MATCH (r:Recipe) WHERE r.id IN $r RETURN r.id, r.title", {"r": [r for _, r in top]}))
        freq = Counter()
        for _, rid in top:
            freq.update(sets[rid] - mine)
        names = {r[0]: r[1:] for r in self.rows(
            "MATCH (i:Ingredient) WHERE i.id IN $ids RETURN i.id, i.name_en, i.is_non_veg, i.is_egg, i.maybe_egg",
            {"ids": list(freq)})}
        flags = []
        for iid, c in freq.most_common():
            share = c / len(top)
            if share < min_share:
                break
            name, nv, egg, maybe = names[iid]
            if (diet == "veg" and (nv or egg or maybe)) or (diet == "egg" and nv):
                continue                      # never suggest something the user's diet excludes
            flags.append({"ingredient_id": iid, "name": name, "share_of_similar": round(share, 2)})
        return {"neighbours": [{"id": r, "title": titles.get(r), "jaccard": round(j, 3)} for j, r in top],
                "flags": flags}

    # -- guard for model output --------------------------------------------
    def not_allowed_for_diet(self, recipe_ids: Iterable[str], diet: str) -> list[str]:
        """Re-check ids an LLM proposed. Returns the ones that must be rejected."""
        ids = list(recipe_ids)
        if not ids:
            return []
        ok = {r[0] for r in self.rows(
            "MATCH (r:Recipe) WHERE r.id IN $ids AND " + _diet_clause(diet) + " RETURN r.id", {"ids": ids})}
        return [i for i in ids if i not in ok]
