#!/usr/bin/env python3
"""Build the shortlisting worksheet from the cleaned export.

Usage: python3 build_review_sheet.py [CLEAN_CSV] [DATA_DIR] [OUT_CSV]

Turns exports/tallinn_restaurants.csv into a sheet for deciding which candidates
join data/restaurants.json. Adds the three things that decision needs and the raw
Google data cannot give you: whether a place is already published, a slug and
taxonomy types pre-mapped to data/taxonomy.json, and a flag column surfacing rows
that need a second look. Nothing is filtered out - all 750 candidates are listed.
"""
import csv, json, math, re, sys, unicodedata, collections
from difflib import SequenceMatcher

CLEAN = sys.argv[1] if len(sys.argv) > 1 else "exports/tallinn_restaurants.csv"
DATA  = sys.argv[2] if len(sys.argv) > 2 else "data"
OUT   = sys.argv[3] if len(sys.argv) > 3 else "exports/tallinn_restaurants_review.csv"

# Estonian letters folded the way a slug needs them; NFKD alone drops the stroke
# on 'õ' but leaves 'š'/'ž' as bare s/z anyway, so spell the intent out.
FOLD = str.maketrans({"ä":"a","õ":"o","ö":"o","ü":"u","š":"s","ž":"z","å":"a","æ":"ae","ø":"o","é":"e","è":"e","ő":"o","ń":"n","ç":"c"})

def slugify(name):
    s = unicodedata.normalize("NFKC", name).lower().translate(FOLD)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-+", "-", s)[:64].strip("-")

def matchkey(name):
    """Loose key for spotting a candidate that is already published."""
    s = slugify(name)
    # Drop the words that decorate a name without identifying it.
    s = re.sub(r"\b(restoran|restaurant|resto|kohvik|cafe|kohv|baar|bar|pub|tallinn|"
               r"the|ja|and|ou|as)\b", "", s.replace("-", " "))
    return re.sub(r"\s+", "", s)

# --- taxonomy ---------------------------------------------------------------
VALID = {t["id"] for t in json.load(open(f"{DATA}/taxonomy.json", encoding="utf-8"))["types"]}
ASIAN = {"Japanese","Chinese","Thai","Korean","Vietnamese","Asian","Taiwanese",
         "Malaysian","Indonesian","Filipino","Indian"}
PUBBY = {"Pub","Bar","Brewpub","Irish Pub","Gastropub","Sports Bar","Brewery",
         "Wine Bar","Cocktail Bar","Bar & Grill","Hookah Bar","Snack Bar"}
COFFEE = {"Cafe","Coffee Shop","Tea House","Cafeteria"}

def suggest_types(row):
    """Pre-map to taxonomy ids. A starting point for the editor, not a verdict:
    casual, hidden-gem, date and laptop are judgement calls and never guessed."""
    cat, cui, price = row["category"], row["cuisine"], row["price"]
    out = []
    if cat in PUBBY:              out.append("pub")
    elif cat in COFFEE:           out.append("coffee")
    elif cat == "Bakery":         out.append("bakery")
    else:                         out.append("restaurant")
    if cui in ASIAN:              out.append("asian")
    if cui == "Vegan / Vegetarian": out.append("vegan")
    if cui == "Georgian":         out.append("caucasian")
    if cat == "Fine Dining Restaurant" or price == "$$$$": out.append("fine-dining")
    if price == "$":              out.append("cheap-eats")
    seen = []
    for t in out:
        if t in VALID and t not in seen: seen.append(t)
    return "; ".join(seen)

PRICE_BAND = {"$": "1", "$$": "2", "$$$": "3", "$$$$": "4"}

# Categories that are not a place you sit down and eat at.
NOT_A_RESTAURANT = {"Performing Arts Theater", "Asian Grocery Store", "Caterer",
                    "Delivery Restaurant", "Food"}

# --- already published ------------------------------------------------------
# A candidate is a duplicate only when the name AND the location agree. Name
# alone is not enough: "Pirosmani Restaurant" shares its name with a published
# Pirosmani 8 km away, and is a second branch rather than the same door.
SAME_DOOR_M = 250

pub = json.load(open(f"{DATA}/restaurants.json", encoding="utf-8"))
taken_ids = {p["id"] for p in pub}
pub_keys = [(matchkey(p["name"]), p) for p in pub]

def metres(lat1, lng1, lat2, lng2):
    return math.hypot((lat1 - lat2) * 111320,
                      (lng1 - lng2) * 111320 * math.cos(math.radians(lat1)))

CITY = re.compile(r"^\s*(\d{5}\s+)?(tallinn|peetri|viimsi|miiduranna|mustam[aä]e|"
                  r"uue maailm|kadriorg)\s*$", re.I)

def addrkey(addr):
    """Street and house number, normalized. 'Port Noblessner, Staapli tn 4,
    10415 Tallinn' and 'Staapli 4, 10415 Tallinn' both reduce to 'staapli4'."""
    parts = [x for x in addr.split(",") if x.strip() and not CITY.match(x)]
    parts = [x for x in parts if re.search(r"\d", x)] or parts
    if not parts:
        return ""
    s = slugify(parts[-1]).replace("-", " ")
    s = re.sub(r"\b(tn|tanav|t)\b", " ", s)          # 'Kopli tn 27' == 'Kopli 27'
    return re.sub(r"[^a-z0-9]", "", s)

def name_agrees(a, b):
    if not a or not b:
        return False
    if a == b:
        return True
    # Containment catches "Telliskivi KoHo" vs the published "KoHo"; the length
    # floor stops a 2-3 letter fragment from matching half the list.
    short, long = sorted((a, b), key=len)
    if len(short) >= 4 and short in long:
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.85

def already_published(row):
    """Closest published place whose name agrees. Returns (place, metres) or
    (None, None) - the caller decides whether the distance makes it the same
    place or a second location."""
    key = matchkey(row["name"])
    lat, lng = float(row["latitude"]), float(row["longitude"])
    hits = [(metres(lat, lng, p["lat"], p["lng"]), p)
            for k, p in pub_keys if name_agrees(key, k)]
    if not hits:
        return None, None
    d, p = min(hits, key=lambda x: x[0])
    return p, d

pub_addr = collections.defaultdict(list)
for _p in pub:
    k = addrkey(_p["address"])
    if k:
        pub_addr[k].append(_p)

# --- build ------------------------------------------------------------------
FIELDS = ["decision","notes","already_on_site","name","rating","reviews","price",
          "cuisine","category","suggested_types","flag","address","postal_code",
          "opening_hours","phone","website","maps_url","suggested_id","price_band",
          "lat","lng","place_id"]

rows = list(csv.DictReader(open(CLEAN, encoding="utf-8")))
out, used_ids, dupes = [], set(taken_ids), 0
for r in rows:
    near, d = already_published(r)
    hit = near if near and d <= SAME_DOOR_M else None
    if hit: dupes += 1

    flags = []
    if hit:
        flags.append("already published")
    elif near:
        flags.append(f'possible second location of "{near["name"]}" '
                     f'({d/1000:.1f} km away) - verify')
    else:
        # The name can miss what the address catches: "180 Degrees Restaurant"
        # and the published "180° by Matthias Diether" share no comparable
        # name, but both sit at Staapli 4. A shared address is not proof - malls
        # and market halls put a dozen unrelated kitchens on one - so this asks
        # for a look rather than declaring a duplicate.
        same = pub_addr.get(addrkey(r["address"]), [])
        if same:
            flags.append("same address as published "
                         + ", ".join(f'"{x["name"]}"' for x in same) + " - verify")
    if r["status"] != "Open":                flags.append("temporarily closed")
    if r["category"] in NOT_A_RESTAURANT:    flags.append("may not be a restaurant")
    if int(r["reviews"]) < 60:               flags.append("thin review count")
    if not r["opening_hours"]:               flags.append("no hours")
    if r["city"] != "Tallinn":               flags.append(f'outside Tallinn ({r["city"]})')
    lat, lng = float(r["latitude"]), float(r["longitude"])
    if not (59.32 <= lat <= 59.52 and 24.5 <= lng <= 25.0):
        flags.append("coords outside the schema's bounds")

    # Unique slug, never colliding with a published id or an earlier candidate.
    base = slugify(r["name"]) or f'place-{r["place_id"][-6:].lower()}'
    sid, n = base, 2
    while sid in used_ids:
        sid = f"{base}-{n}"; n += 1
    used_ids.add(sid)

    out.append({
        "decision":        "",
        "notes":           "",
        "already_on_site": hit["id"] if hit else "",
        "name":            r["name"],
        "rating":          r["rating"],
        "reviews":         r["reviews"],
        "price":           r["price"],
        "cuisine":         r["cuisine"],
        "category":        r["category"],
        "suggested_types": suggest_types(r),
        "flag":            "; ".join(flags),
        "address":         f'{r["address"]}, {r["postal_code"]} {r["city"]}',
        "postal_code":     r["postal_code"],
        "opening_hours":   r["opening_hours"],
        "phone":           r["phone"],
        "website":         r["website"],
        "maps_url":        r["maps_url"],
        "suggested_id":    sid,
        "price_band":      PRICE_BAND.get(r["price"], ""),
        "lat":             f"{lat:.6f}",
        "lng":             f"{lng:.6f}",
        "place_id":        r["place_id"],
    })

# Fresh candidates first, then anything flagged, each best-rated first.
out.sort(key=lambda x: (bool(x["flag"]), -float(x["rating"]), -int(x["reviews"]),
                        x["name"].lower()))

# utf-8-sig: without the BOM, Excel renders 'Taiköök' as mojibake.
with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\r\n")
    w.writeheader(); w.writerows(out)

print(f"wrote {len(out)} rows x {len(FIELDS)} cols -> {OUT}")
print(f"  already published : {dupes} of {len(pub)} site entries matched")
print(f"  unflagged         : {sum(1 for r in out if not r['flag'])}")
print("  flags:", dict(collections.Counter(
    f for r in out for f in r["flag"].split("; ") if f).most_common()))
