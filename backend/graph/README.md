# Recipe graph pipeline (Kuzu)

Converts the Indian recipe spreadsheet into graph tables and loads them into an embedded Kuzu DB.

    pip install pandas openpyxl kuzu
    python test_parse.py
    python build_graph_data.py IndianFoodDatasetXLS.xlsx --out ../../data/graph/out
    python kuzu_load.py ../../data/graph/out ../../data/graph/recipes.kuzu

`graph_store.py` has the queries. Veg filtering is done in code (`veg_safe`), and unparsed recipes
(`diet_class = unknown`) are excluded from the veg filter. Output is generated and git-ignored.
