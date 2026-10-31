"""Build graph-ready tables from the Indian recipe dataset (xlsx).

    python build_graph_data.py /path/IndianFoodDatasetXLS.xlsx --out ../../data/graph/out

Outputs (all UTF-8 CSV, first two columns of edge files are the from/to node ids):
  nodes: recipes, ingredients, cuisines, courses, tags, equipment
  edges: recipe_ingredients (USES), recipe_cuisine, recipe_course, recipe_tags,
         recipe_equipment, similar_recipes, ingredient_cooccurrence
  extra: recipes.jsonl (text to embed + metadata), quality_report.json
"""
from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

import pandas as pd

from parse import (DEVANAGARI, canonical_name, classify_ingredient, diet_tags_from_label,
                   difficulty, equipment_needed, is_no_cook, parse_item, recipe_diet,
                   split_items, steps_count)

UBIQUITOUS_SHARE = 0.20      # ingredients in more than 20% of recipes are ignored for similarity
SIMILAR_TOP_K = 5
SIMILAR_MIN_JACCARD = 0.40
SIMILAR_MIN_SHARED = 3
COOC_MIN_COUNT = 8
MAX_SERVINGS = 50


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def write_csv(path: Path, rows: list[dict], cols: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def clean_int(v, lo=0, hi=None):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    if v < lo or (hi is not None and v > hi):
        return None
    return v


def build(xlsx: Path, out: Path) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    df = pd.read_excel(xlsx)
    report: dict = {"source_rows": int(len(df))}

    recipes, uses_rows = [], []
    ingredients: dict[str, dict] = {}
    ing_recipe_sets: dict[str, set] = defaultdict(set)
    line_stats = Counter()
    jsonl = []
    recipe_sets: dict[str, set] = {}

    for _, r in df.iterrows():
        rid = f"rec_{int(r['Srno']):05d}"
        title = str(r["TranslatedRecipeName"]).strip()
        raw_ing = r["TranslatedIngredients"]
        items = split_items(str(raw_ing)) if isinstance(raw_ing, str) and raw_ing.strip() else []
        parsed = [parse_item(i) for i in items]
        good = [p for p in parsed if p["canonical"] and not p["devanagari"]]
        n_hi = sum(1 for p in parsed if p["devanagari"])
        parsed_ok = bool(good) and len(good) >= 0.5 * len(parsed)
        line_stats["lines"] += len(parsed)
        line_stats["devanagari_lines"] += n_hi
        line_stats["empty_name"] += sum(1 for p in parsed if not p["canonical"] and not p["devanagari"])

        flags = []
        seen = {}
        if parsed_ok:
            for p in good:
                f = classify_ingredient(p["canonical"], p["aliases"])
                flags.append(f)
                line_stats[p["qty_kind"]] += 1
                iid = f"ing_{slug(p['canonical'])}"
                ing = ingredients.setdefault(iid, {
                    "id": iid, "name_en": p["canonical"], "name_hi": "", "aliases": set(),
                    "is_non_veg": f["is_non_veg"], "is_egg": f["is_egg"], "maybe_egg": f["maybe_egg"],
                    "recipe_count": 0, "base_unit": "", "category": "", "nutrients_per_100": "{}",
                })
                ing["aliases"].update(p["aliases"])
                if iid in seen:                    # same ingredient twice in a recipe: add quantities
                    prev = seen[iid]
                    if prev["base_unit"] == p["base_unit"] and prev["qty_base"] is not None and p["qty_base"] is not None:
                        prev["qty_base"] += p["qty_base"]
                        prev["qty"] = (prev["qty"] or 0) + (p["qty"] or 0)
                    continue
                row = {
                    "recipe_id": rid, "ingredient_id": iid, "qty": p["qty"], "qty_hi": p["qty_hi"],
                    "unit": p["unit"], "base_unit": p["base_unit"], "qty_base": p["qty_base"],
                    "qty_kind": p["qty_kind"], "is_optional": int(p["optional"]),
                    "note": p["note"], "raw_line": p["raw"],
                }
                seen[iid] = row
                uses_rows.append(row)
                ing_recipe_sets[iid].add(rid)
        recipe_sets[rid] = set(seen)

        diet = recipe_diet(flags, str(r["Diet"]), parsed_ok, classify_ingredient(title.lower()))
        instr = str(r["TranslatedInstructions"]) if isinstance(r["TranslatedInstructions"], str) else ""
        equip = equipment_needed(instr) if parsed_ok else []
        steps = steps_count(instr)
        prep, cook = clean_int(r["PrepTimeInMins"]), clean_int(r["CookTimeInMins"])
        total = clean_int(r["TotalTimeInMins"], lo=1)
        if total is None and prep is not None and cook is not None and (prep + cook) > 0:
            total = prep + cook
        servings = clean_int(r["Servings"], lo=1, hi=MAX_SERVINGS)
        tags = diet_tags_from_label(str(r["Diet"]))
        if diet["diet_class"] == "veg" and diet["veg_safe"]:
            tags = tags + ["veg"]
        diff = difficulty(total, len(seen), steps, equip) if parsed_ok else "unknown"
        names = [ingredients[i]["name_en"] for i in seen]
        text = (f"{title}. {r['Cuisine']} {r['Course']}. Diet: {diet['diet_class']}"
                f"{' (' + ', '.join(tags) + ')' if tags else ''}. "
                f"Time: {total or '?'} min. Ingredients: {', '.join(names)}.")
        recipes.append({
            "id": rid, "title": title, "title_orig": str(r["RecipeName"]).strip(),
            "servings": servings, "prep_min": prep, "cook_min": cook, "total_min": total,
            "cuisine": str(r["Cuisine"]).strip(), "course": str(r["Course"]).strip(),
            "labelled_diet": str(r["Diet"]).strip(), "diet_class": diet["diet_class"],
            "veg_safe": int(diet["veg_safe"]), "egg_safe": int(diet["egg_safe"]),
            "diet_conflict": int(diet["diet_conflict"]), "difficulty": diff,
            "no_cook": int(is_no_cook(instr)) if parsed_ok else 0,
            "steps_count": steps, "ingredient_count": len(seen),
            "parsed_ok": int(parsed_ok), "equipment": "|".join(equip), "tags": "|".join(tags),
            "url": str(r["URL"]).strip(), "embedding_text": text,
            "servings_suspect": int(servings is None),
        })
        jsonl.append({"id": rid, "text": text, "metadata": {
            "cuisine": r["Cuisine"], "course": r["Course"], "diet_class": diet["diet_class"],
            "veg_safe": diet["veg_safe"], "difficulty": diff, "total_min": total}})

    for iid, ing in ingredients.items():
        ing["recipe_count"] = len(ing_recipe_sets[iid])
        ing["aliases"] = json.dumps(sorted(ing["aliases"] - {ing["name_en"]}), ensure_ascii=False)
        ing["is_non_veg"], ing["is_egg"], ing["maybe_egg"] = int(ing["is_non_veg"]), int(ing["is_egg"]), int(ing["maybe_egg"])
        ing["base_unit"] = ""   # filled by the density/IFCT join step (see docs/03-recipe-graph.md)

    n_rec = len(recipes)
    ubiq = {i for i, s in ing_recipe_sets.items() if len(s) > UBIQUITOUS_SHARE * n_rec}

    # similar recipes (Jaccard on non-ubiquitous ingredients, inverted index)
    inv = defaultdict(list)
    sig = {rid: {i for i in s if i not in ubiq} for rid, s in recipe_sets.items()}
    for rid, s in sig.items():
        for i in s:
            inv[i].append(rid)
    similar = []
    for rid, s in sig.items():
        if len(s) < SIMILAR_MIN_SHARED:
            continue
        shared = Counter()
        for i in s:
            for o in inv[i]:
                if o != rid:
                    shared[o] += 1
        cands = []
        for o, k in shared.items():
            if k < SIMILAR_MIN_SHARED:
                continue
            j = k / (len(s) + len(sig[o]) - k)
            if j >= SIMILAR_MIN_JACCARD:
                cands.append((j, o, k))
        for j, o, k in sorted(cands, reverse=True)[:SIMILAR_TOP_K]:
            similar.append({"recipe_id": rid, "similar_id": o, "jaccard": round(j, 3), "shared": k})

    # ingredient co-occurrence with lift
    pair = Counter()
    for s in sig.values():
        for a, b in combinations(sorted(s), 2):
            pair[(a, b)] += 1
    cooc = []
    for (a, b), c in pair.items():
        if c >= COOC_MIN_COUNT:
            lift = c * n_rec / (len(ing_recipe_sets[a]) * len(ing_recipe_sets[b]))
            cooc.append({"a": a, "b": b, "n_recipes": c, "lift": round(lift, 2)})

    cuisines = sorted({r["cuisine"] for r in recipes})
    courses = sorted({r["course"] for r in recipes})
    tag_set = sorted({t for r in recipes for t in r["tags"].split("|") if t})
    equip_set = sorted({e for r in recipes for e in r["equipment"].split("|") if e})

    write_csv(out / "recipes.csv", recipes, list(recipes[0].keys()))
    ing_cols = ["id", "name_en", "name_hi", "aliases", "category", "base_unit", "is_non_veg",
                "is_egg", "maybe_egg", "recipe_count", "nutrients_per_100"]
    write_csv(out / "ingredients.csv", sorted(ingredients.values(), key=lambda x: -x["recipe_count"]), ing_cols)
    write_csv(out / "recipe_ingredients.csv", uses_rows,
              ["recipe_id", "ingredient_id", "qty", "qty_hi", "unit", "base_unit", "qty_base",
               "qty_kind", "is_optional", "note", "raw_line"])
    write_csv(out / "cuisines.csv", [{"name": c} for c in cuisines], ["name"])
    write_csv(out / "courses.csv", [{"name": c} for c in courses], ["name"])
    write_csv(out / "tags.csv", [{"name": t} for t in tag_set], ["name"])
    write_csv(out / "equipment.csv", [{"name": e} for e in equip_set], ["name"])
    write_csv(out / "recipe_cuisine.csv", [{"recipe_id": r["id"], "name": r["cuisine"]} for r in recipes], ["recipe_id", "name"])
    write_csv(out / "recipe_course.csv", [{"recipe_id": r["id"], "name": r["course"]} for r in recipes], ["recipe_id", "name"])
    write_csv(out / "recipe_tags.csv", [{"recipe_id": r["id"], "name": t} for r in recipes for t in r["tags"].split("|") if t], ["recipe_id", "name"])
    write_csv(out / "recipe_equipment.csv", [{"recipe_id": r["id"], "name": e} for r in recipes for e in r["equipment"].split("|") if e], ["recipe_id", "name"])
    write_csv(out / "similar_recipes.csv", similar, ["recipe_id", "similar_id", "jaccard", "shared"])
    write_csv(out / "ingredient_cooccurrence.csv", cooc, ["a", "b", "n_recipes", "lift"])
    with (out / "recipes.jsonl").open("w", encoding="utf-8") as f:
        for row in jsonl:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    kinds = Counter(r["qty_kind"] for r in uses_rows)
    report.update({
        "recipes": n_rec,
        "recipes_parsed_ok": sum(r["parsed_ok"] for r in recipes),
        "recipes_unknown_diet": sum(r["diet_class"] == "unknown" for r in recipes),
        "diet_class": dict(Counter(r["diet_class"] for r in recipes)),
        "veg_safe": sum(r["veg_safe"] for r in recipes),
        "egg_safe": sum(r["egg_safe"] for r in recipes),
        "diet_conflicts_for_review": sum(r["diet_conflict"] for r in recipes),
        "difficulty": dict(Counter(r["difficulty"] for r in recipes)),
        "no_cook": sum(r["no_cook"] for r in recipes),
        "servings_suspect": sum(r["servings_suspect"] for r in recipes),
        "ingredients_unique": len(ingredients),
        "ingredients_in_1_recipe": sum(1 for i in ingredients.values() if i["recipe_count"] == 1),
        "ingredient_lines": line_stats["lines"],
        "devanagari_lines_skipped": line_stats["devanagari_lines"],
        "lines_with_empty_name": line_stats["empty_name"],
        "uses_edges": len(uses_rows),
        "uses_by_qty_kind": dict(kinds),
        "uses_with_qty_base": sum(1 for r in uses_rows if r["qty_base"] is not None),
        "ubiquitous_ingredients_ignored_for_similarity": sorted(ubiq),
        "similar_edges": len(similar),
        "cooccurrence_edges": len(cooc),
        "top_ingredients": [(i["name_en"], i["recipe_count"]) for i in
                            sorted(ingredients.values(), key=lambda x: -x["recipe_count"])[:25]],
        "nonveg_ingredients_sample": sorted(i["name_en"] for i in ingredients.values() if i["is_non_veg"])[:60],
        "egg_ingredients": sorted(i["name_en"] for i in ingredients.values() if i["is_egg"]),
        "maybe_egg_ingredients": sorted(i["name_en"] for i in ingredients.values() if i["maybe_egg"]),
    })
    (out / "quality_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx", type=Path)
    ap.add_argument("--out", type=Path, default=Path("../../data/graph/out"))
    a = ap.parse_args()
    rep = build(a.xlsx, a.out)
    print(json.dumps({k: v for k, v in rep.items() if not isinstance(v, list)}, indent=2))
