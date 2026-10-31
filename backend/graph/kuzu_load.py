"""Load the recipe graph CSVs (from build_graph_data.py) into an embedded Kuzu database.

    python kuzu_load.py ../../data/graph/out ../../data/graph/recipes.kuzu

Kuzu is embedded (no server, one directory on disk), which suits a hackathon backend and a
read-only copy shipped to the phone later. The same CSVs also load into Neo4j, see
neo4j_load.cypher.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import kuzu

SCHEMA = [
    """CREATE NODE TABLE Recipe(id STRING PRIMARY KEY, title STRING, title_orig STRING,
        servings INT64, prep_min INT64, cook_min INT64, total_min INT64, cuisine STRING,
        course STRING, labelled_diet STRING, diet_class STRING, veg_safe INT64, egg_safe INT64,
        diet_conflict INT64, difficulty STRING, no_cook INT64, steps_count INT64,
        ingredient_count INT64, parsed_ok INT64, equipment STRING, tags STRING, url STRING,
        embedding_text STRING, servings_suspect INT64)""",
    """CREATE NODE TABLE Ingredient(id STRING PRIMARY KEY, name_en STRING, name_hi STRING,
        aliases STRING, category STRING, base_unit STRING, is_non_veg INT64, is_egg INT64,
        maybe_egg INT64, recipe_count INT64, nutrients_per_100 STRING)""",
    "CREATE NODE TABLE Cuisine(name STRING PRIMARY KEY)",
    "CREATE NODE TABLE Course(name STRING PRIMARY KEY)",
    "CREATE NODE TABLE Tag(name STRING PRIMARY KEY)",
    "CREATE NODE TABLE Equipment(name STRING PRIMARY KEY)",
    """CREATE REL TABLE USES(FROM Recipe TO Ingredient, qty DOUBLE, qty_hi DOUBLE, unit STRING,
        base_unit STRING, qty_base DOUBLE, qty_kind STRING, is_optional INT64, note STRING,
        raw_line STRING)""",
    "CREATE REL TABLE IN_CUISINE(FROM Recipe TO Cuisine)",
    "CREATE REL TABLE IN_COURSE(FROM Recipe TO Course)",
    "CREATE REL TABLE HAS_TAG(FROM Recipe TO Tag)",
    "CREATE REL TABLE NEEDS_EQUIPMENT(FROM Recipe TO Equipment)",
    "CREATE REL TABLE SIMILAR(FROM Recipe TO Recipe, jaccard DOUBLE, shared INT64)",
    "CREATE REL TABLE COOCCURS(FROM Ingredient TO Ingredient, n_recipes INT64, lift DOUBLE)",
]

COPIES = [
    ("Recipe", "recipes.csv"), ("Ingredient", "ingredients.csv"), ("Cuisine", "cuisines.csv"),
    ("Course", "courses.csv"), ("Tag", "tags.csv"), ("Equipment", "equipment.csv"),
    ("USES", "recipe_ingredients.csv"), ("IN_CUISINE", "recipe_cuisine.csv"),
    ("IN_COURSE", "recipe_course.csv"), ("HAS_TAG", "recipe_tags.csv"),
    ("NEEDS_EQUIPMENT", "recipe_equipment.csv"), ("SIMILAR", "similar_recipes.csv"),
    ("COOCCURS", "ingredient_cooccurrence.csv"),
]


def load(csv_dir: Path, db_path: Path) -> kuzu.Connection:
    if db_path.exists():
        shutil.rmtree(db_path) if db_path.is_dir() else db_path.unlink()
    db = kuzu.Database(str(db_path))
    conn = kuzu.Connection(db)
    for stmt in SCHEMA:
        conn.execute(stmt)
    for table, fname in COPIES:
        f = (csv_dir / fname).resolve()
        # PARALLEL=false: some text fields contain quoted newlines
        conn.execute(f"COPY {table} FROM '{f}' (HEADER=true, PARALLEL=false)")
    return conn


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: python kuzu_load.py <csv_dir> <db_path>")
    c = load(Path(sys.argv[1]), Path(sys.argv[2]))
    for label in ("Recipe", "Ingredient", "Cuisine", "Course", "Tag", "Equipment"):
        n = c.execute(f"MATCH (n:{label}) RETURN count(*)").get_next()[0]
        print(f"{label}: {n}")
    for rel in ("USES", "SIMILAR", "COOCCURS"):
        n = c.execute(f"MATCH ()-[r:{rel}]->() RETURN count(*)").get_next()[0]
        print(f"{rel}: {n}")
