#!/usr/bin/env python3
"""Reshape the raw Google Places export of Tallinn restaurants into a readable CSV.

Usage: python3 clean_restaurants_csv.py [RAW_CSV] [OUT_CSV]

The raw export comes from etibarhasanov/allRestaurants (exports/tallinn_restaurants.csv):
44 columns, 15 of them entirely empty, hours wrapped across physical lines. This
collapses it to the 18 columns that actually carry data. Re-run it when the
upstream export is refreshed."""
import csv, re, sys, unicodedata, collections

SRC = sys.argv[1] if len(sys.argv) > 1 else "tallinn_restaurants.csv"
DST = sys.argv[2] if len(sys.argv) > 2 else "tallinn_restaurants_clean.csv"

DAYS = {"Monday":"Mon","Tuesday":"Tue","Wednesday":"Wed","Thursday":"Thu",
        "Friday":"Fri","Saturday":"Sat","Sunday":"Sun"}

# Within one Google type, most specific first: "sushi_restaurant" is Japanese
# before it is Asian. Across a row's types, though, the list order says nothing -
# see cuisine_of() for what decides between Korean and Argentinian when Google
# says both.
CUISINE = [
    ("izakaya","Japanese"),("ramen","Japanese"),("sushi","Japanese"),("japanese","Japanese"),
    ("taiwanese","Taiwanese"),("chinese","Chinese"),("thai","Thai"),("korean","Korean"),
    ("vietnamese","Vietnamese"),("malaysian","Malaysian"),("indonesian","Indonesian"),
    ("filipino","Filipino"),("indian","Indian"),
    ("shawarma","Middle Eastern"),("falafel","Middle Eastern"),("kebab","Middle Eastern"),
    ("lebanese","Middle Eastern"),("middle_eastern","Middle Eastern"),("turkish","Turkish"),
    ("greek","Greek"),("mediterranean","Mediterranean"),
    ("tex_mex","Mexican"),("taco","Mexican"),("mexican","Mexican"),
    ("peruvian","Peruvian"),("argentinian","Argentinian"),("brazilian","Brazilian"),
    ("italian","Italian"),("pizza","Pizza"),("french","French"),("belgian","Belgian"),
    ("german","German"),("portuguese","Portuguese"),("tapas","Spanish"),("spanish","Spanish"),
    ("scandinavian","Nordic"),("ukrainian","Ukrainian"),("russian","Russian"),
    ("georgian","Georgian"),("eastern_european","Eastern European"),
    ("hawaiian","Hawaiian"),("american","American"),("hamburger","Burgers"),
    ("oyster","Seafood"),("seafood","Seafood"),("steak","Steakhouse"),
    ("barbecue","Barbecue"),("vegan","Vegan / Vegetarian"),("vegetarian","Vegan / Vegetarian"),
    ("asian","Asian"),("european","European"),
]
# The six tokens above that name a family of kitchens rather than one of them.
# Google hands them out alongside the exact type - Shaurma Kebab is a
# "turkish_restaurant" and a "middle_eastern_restaurant" both - so they are the
# answer only when nothing exact matched anywhere on the row.
BROAD = {"middle_eastern","mediterranean","american","eastern_european","asian","european"}
# Tokens shared by nearly every row - they carry no information.
BOILERPLATE = {"restaurant","food","point_of_interest","establishment","store"}

def norm_ws(s):
    """Collapse Google's narrow/thin spaces and fancy dashes into plain ASCII."""
    s = unicodedata.normalize("NFKC", s or "")
    s = s.replace("–","-").replace("—","-").replace("−","-")
    return re.sub(r"[ \t   ]+", " ", s).strip()

def to24(t, fallback_mer):
    """'6:00 PM' -> '18:00'. Google omits the meridiem on the start time when it
    matches the end time, so callers pass the end's meridiem as a fallback."""
    t = norm_ws(t)
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$", t, re.I)
    if not m:
        return None
    h, mins, mer = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or fallback_mer)
    if mer:
        mer = mer.upper()
        if mer == "PM" and h != 12: h += 12
        if mer == "AM" and h == 12: h = 0
    return f"{h:02d}:{mins:02d}"

def meridiem(t):
    m = re.search(r"(AM|PM)", t, re.I)
    return m.group(1).upper() if m else None

unparsed = []
def fmt_hours(raw, name):
    """One line per day -> 'Mon 10:00-18:00; Sat closed' on a single line."""
    if not raw: return ""
    out = []
    for line in raw.split("\n"):
        line = norm_ws(line)
        if not line: continue
        day, _, spec = line.partition(":")
        day = DAYS.get(day.strip(), day.strip())
        spec = spec.strip()
        if re.fullmatch(r"closed", spec, re.I):
            out.append(f"{day} closed"); continue
        if re.fullmatch(r"open 24 hours", spec, re.I):
            out.append(f"{day} 00:00-24:00"); continue
        spans = []
        for part in spec.split(","):
            a, sep, b = part.partition("-")
            if not sep:
                spans = None; break
            end_mer = meridiem(b)
            s, e = to24(a, end_mer), to24(b, None)
            if not s or not e:
                spans = None; break
            spans.append(f"{s}-{e}")
        if spans is None:
            unparsed.append((name, line))
            out.append(f"{day} {spec}")
        else:
            out.append(f"{day} {', '.join(spans)}")
    return "; ".join(out)

def cuisine_of(primary, types):
    """One word for what a place cooks, out of Google's primary type and its types.

    This used to search the primary type and the types as one string and take the
    first token in CUISINE that appeared anywhere in it, which meant the list's own
    order decided between two kitchens Google had named with equal confidence.
    Siga la Vaca - an Argentinian steakhouse Google types as argentinian_restaurant
    first and korean_restaurant fifth - came out "Korean", because korean sits
    higher up the list than argentinian. Six Indian restaurants came out
    "Chinese" or "Thai" the same way, and every Hesburger came out "American"
    rather than "Burgers".

    So the row's own order decides now. Google lists the primary type first and then
    the types from most to least characteristic, and that order is the only opinion
    about the place either of us has: the first type that names a kitchen wins.
    Two things bend it, both of them about what a type actually claims:

      - a BROAD label is held back to a second pass, so an exact kitchen anywhere
        on the row beats a family name at the front of it. Nine rows turn on this
        and all nine read better for it: Farm is Nordic and not European, Sakura
        Resto is Japanese and not Asian.
      - a "*_delivery" type is skipped, because it says how food travels rather
        than what it is. Restoran Kishmish is a Middle Eastern restaurant that
        also delivers pizza, and one "pizza_delivery" in twelve types is not a
        claim that it is a pizzeria.

    Tokens match a whole underscore-delimited word, not a substring, so "american"
    no longer answers for latin_american_restaurant and south_american_restaurant -
    the three rows carrying those are two Argentinian steakhouses and a seafood
    restaurant. KITCHENS in functions/api/venues.js had the same hole.
    """
    parts = [(primary or "").lower()] + [t.strip().lower() for t in (types or "").split(",")]
    parts = [p for p in parts if p and not p.endswith("_delivery")]
    for broad in (False, True):
        for part in parts:
            for token, label in CUISINE:
                if (token in BROAD) != broad:
                    continue
                if re.search(rf"(^|_){token}(_|$)", part):
                    return label
    return ""

def tidy_tags(types):
    seen, out = set(), []
    for t in (types or "").split(","):
        t = t.strip().lower()
        if not t or t in BOILERPLATE or t in seen: continue
        seen.add(t)
        out.append(t.replace("_", " ").title())
    return "; ".join(out)

# Google prefixes an address with where the map pin sits, not where the door is.
# "Parking lot, Keldrimäe tn 9" is not how Estonian post writes it. Venue names
# ("Port Noblessner", "Balti Jaama Turg") are kept - those do locate a place.
PIN_PREFIX = re.compile(r"^(parking lot|parkla)\s*,\s*", re.I)

def clean_address(short, city):
    return PIN_PREFIX.sub("", norm_ws(short)).removesuffix(f", {city}").strip()

def titlecase_label(s):
    s = norm_ws(s)
    # The source has 'Shawarma restaurant' alongside 'Sushi Restaurant'.
    return re.sub(r"\brestaurant\b", "Restaurant", s)

FIELDS = ["name","category","cuisine","rating","reviews","price","status","address",
          "postal_code","city","phone","website","opening_hours","tags",
          "latitude","longitude","maps_url","place_id"]

rows = list(csv.DictReader(open(SRC, encoding="utf-8")))
clean = []
for r in rows:
    clean.append({
        "name":          norm_ws(r["name"]),
        "category":      titlecase_label(r["primary_type_label"]) or "Restaurant",
        "cuisine":       cuisine_of(r["primary_type"], r["types"]),
        "rating":        f'{float(r["rating"]):.1f}',
        "reviews":       int(r["user_rating_count"]),
        "price":         r["price_label"],
        "status":        "Open" if r["business_status"] == "OPERATIONAL" else "Temporarily closed",
        "address":       clean_address(r["short_address"], r["city"]),
        "postal_code":   r["postal_code"],
        "city":          r["city"],
        # phone_international is unambiguous; the local format duplicates it.
        "phone":         norm_ws(r["phone_international"]),
        "website":       r["website"],
        "opening_hours": fmt_hours(r["opening_hours"], r["name"]),
        "tags":          tidy_tags(r["types"]),
        "latitude":      f'{float(r["latitude"]):.6f}',
        "longitude":     f'{float(r["longitude"]):.6f}',
        # Drop Google's &g_mp= telemetry blob, which is ~90 chars of noise per row.
        "maps_url":      r["google_maps_url"].split("&g_mp=")[0],
        "place_id":      r["place_id"],
    })

clean.sort(key=lambda x: (-float(x["rating"]), -x["reviews"], x["name"].lower()))
with open(DST, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
    w.writeheader(); w.writerows(clean)

print(f"wrote {len(clean)} rows x {len(FIELDS)} cols -> {DST}")
print(f"cuisine assigned: {sum(1 for c in clean if c['cuisine'])}/{len(clean)}")
if unparsed:
    print(f"UNPARSED HOUR SPANS ({len(unparsed)}):")
    for n,l in unparsed[:20]: print("   ",n,"|",l)
