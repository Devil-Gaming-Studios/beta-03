"""Unit tests for parse.py. Run: python test_parse.py (or pytest) from backend/graph."""
from parse import (canonical_name, classify_ingredient, difficulty, parse_item, recipe_diet,
                   split_items)


def test_split_items_keeps_note_commas():
    items = split_items("1 Onion - thinly sliced, finely chopped,Salt - to taste,2 Curd (Dahi, Yogurt)")
    assert items == ["1 Onion - thinly sliced, finely chopped", "Salt - to taste", "2 Curd (Dahi, Yogurt)"], items


def test_split_items_lowercase_style():
    items = split_items("1 cup chana dal, fenugreek - one bundle (wash), 1/4 teaspoon asafoetida")
    assert len(items) == 3, items


def test_measured_units():
    p = parse_item("3 tablespoon Gram flour (besan)")
    assert (p["qty"], p["unit"], p["base_unit"], p["qty_base"]) == (3, "tbsp", "ml", 45), p
    assert p["canonical"] == "besan" and p["qty_kind"] == "measured"
    assert "besan" in p["aliases"]
    p = parse_item("500 grams Chicken - chopped to bite size")
    assert p["qty_base"] == 500 and p["base_unit"] == "g" and p["note"].startswith("chopped")


def test_fractions_and_ranges():
    assert parse_item("1/4 teaspoon Saffron strands")["qty"] == 0.25
    assert parse_item("1 1/2 cup Rice")["qty"] == 1.5
    assert parse_item("1-1 / 4 cup sweet corn - mash")["qty"] == 1.25
    p = parse_item("5-6 Cumin seeds (Jeera)")
    assert p["qty"] == 5.5 and p["qty_hi"] == 6 and p["unit"] == "pcs"


def test_counts_and_sizes():
    p = parse_item("1 large Onion - sliced")
    assert (p["qty"], p["unit"], p["qty_kind"], p["canonical"]) == (1, "pcs", "count", "onion"), p
    p = parse_item("8 cloves Garlic")
    assert p["unit"] == "clove" and p["base_unit"] == "pcs" and p["qty_base"] == 8


def test_unit_word_is_the_ingredient():
    p = parse_item("2 Cloves (Laung)")
    assert (p["canonical"], p["qty"], p["unit"], p["qty_base"]) == ("clove", 2, "pcs", 2), p
    assert parse_item("8 cloves Garlic")["canonical"] == "garlic"


def test_of_and_or_and_lb():
    assert parse_item("1 sprig of mint")["canonical"] == "mint"
    p = parse_item("3 or 4 Green Chillies - chopped")
    assert p["qty"] == 3.5 and p["canonical"] == "green chilli", p
    p = parse_item("1 lb Fish fillet")
    assert p["base_unit"] == "g" and round(p["qty_base"]) == 454 and p["canonical"] == "fish fillet", p


def test_non_quantified():
    assert parse_item("Salt - to taste")["qty_kind"] == "to_taste"
    assert parse_item("Sunflower Oil - for cooking")["canonical"] == "cooking oil"
    p = parse_item("Asafoetida (hing) - a pinch")
    assert p["qty_kind"] == "pinch" and p["unit"] == "pinch"
    p = parse_item("pinch Asafoetida (hing)")
    assert p["qty"] == 1 and p["unit"] == "pinch" and p["canonical"] == "asafoetida"
    p = parse_item("1 inch Ginger - grated")
    assert p["qty_kind"] == "unmeasured" and p["qty_base"] is None
    assert parse_item("1/2 teaspoon Cardamom Powder (Elaichi) - (optional)")["optional"]


def test_canonical_names():
    assert canonical_name("Tomatoes") == "tomato"
    assert canonical_name("Green Chillies") == "green chilli"
    assert canonical_name("Curry leaves") == "curry leaves"
    assert canonical_name("Ripe Bananas") == "banana"
    assert canonical_name("Hung Curd (Greek Yogurt)") == "hung curd"
    assert canonical_name("Cottage Cheese (Paneer)") == "paneer"


def test_diet_classification():
    c = lambda n: classify_ingredient(canonical_name(n))
    assert c("Chicken breasts")["is_non_veg"]
    assert c("Whole Egg")["is_egg"] and not c("Whole Egg")["is_non_veg"]
    assert not c("Brinjal")["is_egg"] and not c("Eggplant")["is_egg"]
    assert not c("Eggless Mayonnaise")["maybe_egg"] and c("Mayonnaise")["maybe_egg"]
    assert not c("Oyster Mushrooms")["is_non_veg"] and c("Oyster Sauce")["is_non_veg"]
    assert not c("Soya Chunks")["is_non_veg"] and not c("Veg Mutton")["is_non_veg"]
    assert c("Gelatin")["is_non_veg"] and c("Worcestershire Sauce")["is_non_veg"]
    assert not c("Goat Cheese")["is_non_veg"] and not c("Coconut Meat")["is_non_veg"]


def test_recipe_diet_strictness():
    veg = [classify_ingredient("onion")]
    assert recipe_diet(veg, "Vegetarian", True)["veg_safe"]
    assert not recipe_diet(veg, "Non Vegeterian", True)["veg_safe"]          # label says non-veg
    assert not recipe_diet(veg, "Eggetarian", True)["veg_safe"]
    assert not recipe_diet(veg, "Vegetarian", False)["veg_safe"]             # unparsed -> unsafe
    mayo = [classify_ingredient("mayonnaise")]
    assert not recipe_diet(mayo, "Vegetarian", True)["veg_safe"]             # maybe egg
    nv = [classify_ingredient("chicken")]
    d = recipe_diet(nv, "Vegetarian", True)
    assert d["diet_class"] == "non_veg" and d["diet_conflict"] and not d["veg_safe"]


def test_title_overrides_ingredients_on_strict_side():
    veg = [classify_ingredient("flour")]
    d = recipe_diet(veg, "Vegetarian", True, classify_ingredient("chicken pies recipe"))
    assert not d["veg_safe"] and not d["egg_safe"] and d["diet_conflict"], d
    d = recipe_diet(veg, "Vegetarian", True, classify_ingredient("chickpea curry recipe"))
    assert d["veg_safe"], d
    d = recipe_diet(veg, "Vegetarian", True, classify_ingredient("brinjal eggplant bharta"))
    assert d["veg_safe"], d


def test_difficulty():
    assert difficulty(20, 6, 8, ["stove"]) == "beginner"
    assert difficulty(45, 12, 15, ["stove"]) == "intermediate"
    assert difficulty(120, 20, 30, ["oven"]) == "advanced"


if __name__ == "__main__":
    n = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            n += 1
    print(f"{n} tests passed")
