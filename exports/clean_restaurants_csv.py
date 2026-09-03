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

# Most specific first: the first token that matches wins.
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
    hay = f"{primary},{types}".lower()
    for token, label in CUISINE:
        if token in hay:
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
