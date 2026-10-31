"""Pure parsing and classification helpers for the recipe graph pipeline.

No file or network access here, so everything can be unit tested (see test_parse.py).

Design notes
- Ingredient lines are free text ("1/4 teaspoon Turmeric powder (Haldi) - to taste").
  We split them into quantity, unit, canonical name, aliases and note.
- Diet class is derived from ingredient names in code, never taken from the dataset's
  free-form `Diet` label (which mixes veg/non-veg with health tags) and never from an LLM.
- Anything we cannot parse is marked `unknown`, and the strict veg filter treats
  `unknown` as NOT safe.
"""
from __future__ import annotations

import re
from fractions import Fraction

DEVANAGARI = re.compile(r"[ऀ-ॿ]")

# token -> (canonical unit, base unit or None, factor to base unit or None)
_U = {}


def _add(tokens, unit, base, factor):
    for t in tokens.split():
        _U[t] = (unit, base, factor)


_add("g gm gms gram grams", "g", "g", 1)
_add("kg kgs kilogram kilograms", "kg", "g", 1000)
_add("lb lbs pound pounds", "lb", "g", 453.6)
_add("oz ounce ounces", "oz", "g", 28.35)
_add("ml millilitre millilitres milliliter milliliters", "ml", "ml", 1)
_add("litre litres liter liters ltr", "l", "ml", 1000)
_add("tsp tsps teaspoon teaspoons", "tsp", "ml", 5)
_add("tbsp tbsps tbs tablespoon tablespoons", "tbsp", "ml", 15)
_add("cup cups", "cup", "ml", 240)
_add("clove cloves", "clove", "pcs", 1)
_add("sprig sprigs", "sprig", "pcs", 1)
_add("piece pieces pc pcs", "pcs", "pcs", 1)
_add("slice slices", "slice", "pcs", 1)
_add("pod pods", "pod", "pcs", 1)
_add("stalk stalks", "stalk", "pcs", 1)
_add("inch inches", "inch", None, None)
_add("pinch pinches", "pinch", None, None)
_add("bunch bunches bundle", "bunch", None, None)
_add("handful", "handful", None, None)
_add("dash drop drops", "dash", None, None)
_add("can cans packet packets pack sachet", "pack", None, None)
UNIT_TABLE = _U

SIZE_WORDS = {"large", "medium", "small", "big"}
LEAD_DROP = {
    "large", "medium", "small", "big", "fresh", "ripe", "finely", "roughly",
    "thinly", "chopped", "sliced", "diced", "grated", "crushed", "minced", "peeled", "of",
}

NUM = r"(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)"
QTY_RE = re.compile(rf"^(?P<a>{NUM})(?:\s*(?:-|–|to|or)\s*(?P<b>{NUM}))?(?![\d/])")

_UNICODE_FRAC = {"½": " 1/2", "¼": " 1/4", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3", "⅛": " 1/8"}


def _norm_fractions(s: str) -> str:
    s = s.replace("\xa0", " ")
    for k, v in _UNICODE_FRAC.items():
        s = s.replace(k, v)
    s = re.sub(r"(\d+)\s*/\s*(\d+)", r"\1/\2", s)      # "1 / 4" -> "1/4"
    s = re.sub(r"(\d+)\s*-\s*(\d+/\d+)", r"\1 \2", s)  # "1-1/4" -> "1 1/4"
    return re.sub(r"\s+", " ", s).strip()


def to_float(txt: str) -> float:
    total = Fraction(0)
    for part in txt.split():
        total += Fraction(part)
    return float(total)


def split_top_level_commas(s: str) -> list[str]:
    parts, depth, cur = [], 0, []
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    parts.append("".join(cur))
    return parts


def _has_note_dash(s: str) -> bool:
    return bool(re.search(r"\s[-–—]\s", s))


def _is_continuation(fragment: str, prev: str) -> bool:
    """A comma-split fragment that is really the tail of the previous item's note."""
    if not prev or not _has_note_dash(prev):
        return False
    f = fragment.strip()
    if not f or f[0].isdigit() or f[0].isupper() or DEVANAGARI.search(f):
        return False
    if _has_note_dash(f):
        return False
    first = f.split()[0].lower().strip(".")
    return first not in UNIT_TABLE


def split_items(s: str) -> list[str]:
    s = _norm_fractions(s)
    items: list[str] = []
    for p in split_top_level_commas(s):
        p = p.strip()
        if not p:
            continue
        if items and _is_continuation(p, items[-1]):
            items[-1] += ", " + p
        else:
            items.append(p)
    return items


def _split_note(s: str) -> tuple[str, str]:
    depth = 0
    for i, ch in enumerate(s):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch in "-–—" and depth == 0 and 0 < i < len(s) - 1 and s[i - 1] == " " and s[i + 1] == " ":
            return s[:i].strip(), s[i + 1:].strip()
    return s.strip(), ""


# --- name canonicalisation -------------------------------------------------

_SYNONYMS = {
    "yogurt": "curd", "yoghurt": "curd", "dahi": "curd",
    "capsicum": "capsicum", "green bell pepper": "capsicum",
    "brinjal": "brinjal", "eggplant": "brinjal", "aubergine": "brinjal",
    "cottage cheese": "paneer",
    "all purpose flour": "maida", "plain flour": "maida", "refined flour": "maida",
    "gram flour": "besan",
    "ladies finger": "okra", "bhindi": "okra",
    "oil": "cooking oil", "sunflower oil": "cooking oil", "vegetable oil": "cooking oil",
    "refined oil": "cooking oil", "canola oil": "cooking oil", "cooking oil": "cooking oil",
    "cashew": "cashew nut", "cilantro": "coriander leaves",
}

_KEEP_S = ("ss", "us", "is", "leaves")


def _singular(word: str) -> str:
    if word.endswith("chillies"):
        return word[:-3] + "i"          # chillies -> chilli
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 4 and word.endswith("oes"):
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith(_KEEP_S):
        return word[:-1]
    return word


def canonical_name(raw: str) -> str:
    s = re.sub(r"\([^)]*\)", " ", raw).lower()
    s = s.replace("&", " and ").replace("chili", "chilli")
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    words = [w for w in s.replace("-", " ").split() if w]
    while words and (words[0] in LEAD_DROP or words[0].isdigit()):
        words.pop(0)
    if not words:
        return ""
    words[-1] = _singular(words[-1])
    name = " ".join(words)
    return _SYNONYMS.get(name, name)


def parse_item(raw: str) -> dict:
    """Parse one ingredient line into a flat dict."""
    s = _norm_fractions(raw)
    left, note = _split_note(s)
    note_l = note.lower()
    out = {
        "raw": raw.strip(), "qty": None, "qty_hi": None, "unit": "", "base_unit": "",
        "qty_base": None, "qty_kind": "unspecified", "name_raw": "", "canonical": "",
        "aliases": [], "note": note, "optional": False, "devanagari": bool(DEVANAGARI.search(s)),
    }
    m = QTY_RE.match(left)
    rest = left
    qty = None
    if m:
        a = to_float(m.group("a"))
        b = to_float(m.group("b")) if m.group("b") else None
        qty = (a + b) / 2 if b is not None else a
        out["qty_hi"] = b
        rest = left[m.end():].strip()
    tokens = rest.split()
    unit_info = None
    while tokens and tokens[0].lower() in SIZE_WORDS:
        tokens.pop(0)
    if tokens and tokens[0].lower().strip(".") in UNIT_TABLE:
        unit_info = UNIT_TABLE[tokens[0].lower().strip(".")]
        tokens.pop(0)
        if qty is None:
            qty = 1.0
    name_part = " ".join(tokens)
    if unit_info and not re.sub(r"\([^)]*\)", " ", name_part).strip():
        # "2 Cloves (Laung)": the unit word is really the ingredient (the spice)
        unit_word = rest.split()[len([t for t in rest.split() if t.lower() in SIZE_WORDS])]
        name_part = (unit_word + " " + name_part).strip()
        unit_info = UNIT_TABLE["piece"]

    aliases = []
    for grp in re.findall(r"\(([^)]*)\)", name_part):
        for a in re.split(r"[/,]", grp):
            a = a.strip().lower()
            if not a:
                continue
            if "optional" in a:
                out["optional"] = True
            else:
                aliases.append(a)
    if "optional" in note_l:
        out["optional"] = True

    out["name_raw"] = name_part
    out["canonical"] = canonical_name(name_part)
    out["aliases"] = aliases

    if qty is not None:
        out["qty"] = qty
        if unit_info:
            unit, base, factor = unit_info
            out["unit"] = unit
            if factor:
                out["base_unit"], out["qty_base"] = base, qty * factor
                out["qty_kind"] = "measured" if base in ("g", "ml") else "count"
            else:
                out["qty_kind"] = "pinch" if unit in ("pinch", "dash") else "unmeasured"
        else:
            out["unit"], out["base_unit"], out["qty_base"], out["qty_kind"] = "pcs", "pcs", qty, "count"
    else:
        if "taste" in note_l:
            out["qty_kind"] = "to_taste"
        elif "pinch" in note_l:
            out["qty_kind"], out["unit"], out["qty"] = "pinch", "pinch", 1.0
        elif re.search(r"as (required|needed|per use)|for |little|some|garnish|drizzle", note_l):
            out["qty_kind"] = "as_needed"
    return out


# --- diet classification ---------------------------------------------------

_NONVEG_WORDS = (
    "chicken mutton lamb goat beef pork bacon ham sausage salami pepperoni keema "
    "fish prawn shrimp crab lobster squid calamari mussel clam scallop octopus "
    "salmon tuna sardine anchovy anchovies pomfret rohu hilsa mackerel tilapia trout "
    "eel duck turkey quail gelatin gelatine lard tallow worcestershire seafood"
).split()
_NONVEG_RE = re.compile(
    r"\b(" + "|".join(_NONVEG_WORDS) + r")s?\b"
    r"|\boysters?\b(?!\s+mushroom)"
    r"|\bmeat\b(?!less)"
    r"|\bfish sauce\b|\boyster sauce\b|\bshrimp paste\b|\bbone broth\b|\bchicken stock\b",
    re.I,
)
_VEG_EXCEPT_RE = re.compile(
    r"\b(veg|vegetable|vegan|mock|soy|soya|plant)\s+(chicken|mutton|meat|fish|keema|mince)\b"
    r"|\bgoat\s+(cheese|milk|curd)\b|coconut meat|\bmeatless\b|\bsweetmeat\b",
    re.I,
)
_EGG_RE = re.compile(r"\begg(s)?\b|\bmeringue\b", re.I)
_EGG_EXCEPT_RE = re.compile(r"egg[\s-]?(less|free|replacer|substitute)|flax egg", re.I)
_MAYBE_EGG_RE = re.compile(r"\bmayo(nnaise)?\b", re.I)


def classify_ingredient(canonical: str, aliases: list[str] | None = None) -> dict:
    text = " ".join([canonical] + list(aliases or []))
    nonveg = bool(_NONVEG_RE.search(text)) and not _VEG_EXCEPT_RE.search(text)
    egg = bool(_EGG_RE.search(text)) and not _EGG_EXCEPT_RE.search(text)
    maybe_egg = bool(_MAYBE_EGG_RE.search(text)) and not re.search(r"eggless|vegan|egg[\s-]?free", text, re.I)
    return {"is_non_veg": nonveg, "is_egg": egg, "maybe_egg": maybe_egg}


NONVEG_LABELS = {"Non Vegeterian", "High Protein Non Vegetarian"}
EGG_LABELS = {"Eggetarian"}


def diet_tags_from_label(label: str) -> list[str]:
    m = {
        "Diabetic Friendly": ["diabetic_friendly"],
        "High Protein Vegetarian": ["high_protein"],
        "High Protein Non Vegetarian": ["high_protein"],
        "Gluten Free": ["gluten_free"],
        "Sugar Free Diet": ["sugar_free"],
        "No Onion No Garlic (Sattvic)": ["sattvic"],
        "Vegan": ["vegan_labelled"],
    }
    return m.get(label, [])


def recipe_diet(ingredient_flags: list[dict], label: str, parsed_ok: bool, title_flags: dict | None = None) -> dict:
    """Return diet_class, veg_safe, egg_safe, diet_conflict for one recipe."""
    if not parsed_ok:
        return {"diet_class": "unknown", "veg_safe": False, "egg_safe": False, "diet_conflict": False}
    has_nv = any(f["is_non_veg"] for f in ingredient_flags)
    has_egg = any(f["is_egg"] for f in ingredient_flags)
    has_maybe = any(f["maybe_egg"] for f in ingredient_flags)
    cls = "non_veg" if has_nv else ("eggetarian" if has_egg else "veg")
    label_nv = label in NONVEG_LABELS
    label_egg = label in EGG_LABELS
    veg_safe = cls == "veg" and not has_maybe and not label_nv and not label_egg
    egg_safe = cls in ("veg", "eggetarian") and not label_nv
    tf = title_flags or {}
    title_nv = bool(tf.get("is_non_veg"))
    title_egg = bool(tf.get("is_egg"))
    if title_nv:                       # title names meat/fish but ingredients do not: strict side
        veg_safe = egg_safe = False
    if title_egg:
        veg_safe = False
    conflict = (title_nv and cls != "non_veg") or (label_nv and cls != "non_veg") or (label_egg and cls == "veg") or (
        label in {"Vegetarian", "Vegan", "High Protein Vegetarian"} and cls != "veg")
    return {"diet_class": cls, "veg_safe": veg_safe, "egg_safe": egg_safe, "diet_conflict": conflict}


# --- recipe-level derivations ----------------------------------------------

_HEAT = re.compile(r"\b(heat|cook|boil|fry|saut[eé]|simmer|bake|roast|pressure|steam|grill|toast|temper|tadka|sear)", re.I)
_EQUIP = {
    "pressure_cooker": re.compile(r"pressure cook|whistle", re.I),
    "microwave": re.compile(r"microwave", re.I),
    "mixer": re.compile(r"\b(mixer|blender|grinder|mixie|food processor|blend|grind)", re.I),
    "rice_cooker": re.compile(r"rice cooker", re.I),
    "oven": re.compile(r"\b(oven|bake|baking)\b", re.I),
    "kettle": re.compile(r"\bkettle\b", re.I),
}


def steps_count(instructions: str) -> int:
    t = (instructions or "").replace("\xa0", " ")
    return max(1, len(re.split(r"(?<=[.!?])\s*(?=[A-Z])", t.strip()))) if t.strip() else 0


def equipment_needed(instructions: str) -> list[str]:
    t = instructions or ""
    found = [k for k, rx in _EQUIP.items() if rx.search(t)]
    heat = bool(_HEAT.search(t))
    if heat and "microwave" not in found and "oven" not in found and "rice_cooker" not in found:
        found.append("stove")
    elif heat and not found:
        found.append("stove")
    return sorted(set(found))


def is_no_cook(instructions: str) -> bool:
    return bool(instructions) and not _HEAT.search(instructions)


def difficulty(total_min: int | None, n_ingredients: int, steps: int, equipment: list[str]) -> str:
    t = total_min if total_min else 45
    if t <= 30 and n_ingredients <= 9 and steps <= 12 and not ({"oven"} & set(equipment)):
        return "beginner"
    if t <= 60 and n_ingredients <= 16 and steps <= 25:
        return "intermediate"
    return "advanced"
