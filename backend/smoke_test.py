"""Smoke test for the local API (spec 6.13). Run from backend/: python smoke_test.py

Covers: token auth, cross-household refusal, refresh rotation and reuse, plan -> done deduction,
missing-item detection, shopping list, and confirm-only AI writes.
"""

from __future__ import annotations

import json
import sys
import time

import httpx

BASE = "http://127.0.0.1:8000"
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}{('  [' + detail + ']') if detail else ''}")


def login(email: str) -> dict:
    r = httpx.post(f"{BASE}/auth/dev-login", json={"email": email, "name": email.split("@")[0]})
    r.raise_for_status()
    return r.json()


def auth(token: str) -> dict:
    return {"authorization": f"Bearer {token}"}


def main() -> int:
    health = httpx.get(f"{BASE}/health", timeout=10).json()
    check("health reports llama3.1", health.get("model") == "llama3.1", str(health.get("provider")))

    # --- auth and profile
    a = login("alpha@local")
    b = login("beta@local")
    check("dev login issues access + refresh", bool(a["access_token"] and a["refresh_token"]))
    check("two households differ", a["household_id"] != b["household_id"])

    no_token = httpx.get(f"{BASE}/api/stock")
    check("unauthenticated request rejected", no_token.status_code == 401, str(no_token.status_code))

    me = httpx.get(f"{BASE}/api/me", headers=auth(a["access_token"])).json()
    check("me returns household and members", me["household"]["id"] == a["household_id"] and len(me["members"]) == 3)

    bad = httpx.get(f"{BASE}/api/stock", headers=auth(a["access_token"][:-3] + "xyz"))
    check("tampered token rejected", bad.status_code == 401, str(bad.status_code))

    import app as api  # same process env -> same signing secret
    expired = api._sign({"sub": a["user_id"], "hh": a["household_id"], "cid": a["client_id"], "role": "owner",
                         "iss": api.JWT_ISSUER, "aud": api.JWT_AUDIENCE, "iat": int(time.time()) - 1200,
                         "exp": int(time.time()) - 600, "jti": "test"})
    check("expired token rejected", httpx.get(f"{BASE}/api/stock", headers=auth(expired)).status_code == 401)

    wrong_aud = api._sign({"sub": a["user_id"], "hh": a["household_id"], "cid": a["client_id"], "role": "owner",
                           "iss": api.JWT_ISSUER, "aud": "someone-else", "iat": int(time.time()),
                           "exp": int(time.time()) + 600, "jti": "test2"})
    check("wrong audience rejected", httpx.get(f"{BASE}/api/stock", headers=auth(wrong_aud)).status_code == 401)

    forged_hh = api._sign({"sub": a["user_id"], "hh": b["household_id"], "cid": a["client_id"], "role": "owner",
                           "iss": api.JWT_ISSUER, "aud": api.JWT_AUDIENCE, "iat": int(time.time()),
                           "exp": int(time.time()) + 600, "jti": "test3"})
    check("household swap in token rejected", httpx.get(f"{BASE}/api/stock", headers=auth(forged_hh)).status_code == 401)

    # --- baseline loop
    hdr_a, hdr_b = auth(a["access_token"]), auth(b["access_token"])
    recipes = httpx.get(f"{BASE}/api/recipes", headers=hdr_a).json()["recipes"]
    check("household recipes mirrored", len(recipes) >= 4, f"{len(recipes)} recipes")
    dal = next(r for r in recipes if r["title"] == "Dal Chawal")
    paneer = next(r for r in recipes if r["title"] == "Paneer Bhurji")

    scaled = httpx.get(f"{BASE}/api/recipes/{dal['id']}?servings=4", headers=hdr_a).json()
    chawal_2 = next(i["qty_base"] for i in scaled["ingredients"] if i["name"] == "chawal")
    check("quantities scale with servings", chawal_2 == 360.0, f"chawal for 4 = {chawal_2}")

    stock_before = {s["name"]: s["qty_base"] for s in httpx.get(f"{BASE}/api/stock", headers=hdr_a).json()["stock"]}
    today = time.strftime("%Y-%m-%d")
    meal = httpx.post(f"{BASE}/api/plan/meals", headers=hdr_a, json={
        "meal_date": today, "slot": "lunch", "household_recipe_id": dal["id"], "servings": 2}).json()

    plan = httpx.get(f"{BASE}/api/plan", headers=hdr_a).json()
    check("meal appears in plan", any(m["id"] == meal["id"] for m in plan["meals"]))

    done = httpx.post(f"{BASE}/api/plan/meals/{meal['id']}/done", headers=hdr_a).json()
    stock_after = {s["name"]: s["qty_base"] for s in done["stock"]}
    expected_dal = round(stock_before["dal"] - 150.0, 1)
    check("mark-done deducts stock", abs(stock_after["dal"] - expected_dal) < 0.01,
          f"dal {stock_before['dal']} -> {stock_after['dal']}")
    again = httpx.post(f"{BASE}/api/plan/meals/{meal['id']}/done", headers=hdr_a)
    check("double mark-done refused", again.status_code == 409, str(again.status_code))

    # missing items: paneer has no stock for this household
    httpx.post(f"{BASE}/api/plan/meals", headers=hdr_a, json={
        "meal_date": today, "slot": "dinner", "household_recipe_id": paneer["id"], "servings": 2})
    checkres = httpx.get(f"{BASE}/api/plan/check", headers=hdr_a).json()
    missing_names = {m["name"] for m in checkres["missing"]}
    check("stock check flags missing paneer", "paneer" in missing_names, ",".join(sorted(missing_names)))

    gen = httpx.post(f"{BASE}/api/shopping-list/generate", headers=hdr_a, json={}).json()
    listed = {i["name"] for i in httpx.get(f"{BASE}/api/shopping-list", headers=hdr_a).json()["items"]}
    check("shopping list built from plan", "paneer" in listed and len(gen["items"]) > 0, ",".join(sorted(listed)))

    # --- cross-household isolation
    cross = httpx.post(f"{BASE}/api/plan/meals/{meal['id']}/done", headers=hdr_b)
    check("other household cannot touch a meal", cross.status_code == 404, str(cross.status_code))
    cross_recipe = httpx.get(f"{BASE}/api/recipes/{dal['id']}", headers=hdr_b)
    check("other household cannot read a recipe id", cross_recipe.status_code == 404, str(cross_recipe.status_code))

    # --- refresh rotation and reuse
    r1 = httpx.post(f"{BASE}/auth/refresh", json={"refresh_token": a["refresh_token"], "client_id": a["client_id"]})
    check("refresh rotates", r1.status_code == 200 and r1.json()["refresh_token"] != a["refresh_token"])
    reuse = httpx.post(f"{BASE}/auth/refresh", json={"refresh_token": a["refresh_token"], "client_id": a["client_id"]})
    check("refresh reuse detected", reuse.status_code == 401, str(reuse.status_code))
    after_reuse = httpx.post(f"{BASE}/auth/refresh",
                             json={"refresh_token": r1.json()["refresh_token"], "client_id": a["client_id"]})
    check("family revoked after reuse", after_reuse.status_code == 401, str(after_reuse.status_code))

    # --- confirm-only writes
    conn_audit = httpx.get(f"{BASE}/api/sync", headers=hdr_b).json()
    check("sync delta endpoint responds", "changes" in conn_audit)

    payload = {"proposal_id": "00000000-0000-0000-0000-000000000000"}
    bad_confirm = httpx.post(f"{BASE}/api/confirm", headers=hdr_a, json=payload)
    check("unknown proposal refused", bad_confirm.status_code == 404, str(bad_confirm.status_code))

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
