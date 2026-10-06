---
paths:
  - "data/split.json"
  - "split.html"
  - "assets/split.js"
  - "assets/split.css"
  - "functions/split.js"
  - "functions/api/split.js"
---

You are in **splitwise**: the bill-splitting page on its own subdomain, which
has no skill of its own. Load `/site` for the page and `/api` for the route if
they are not loaded already, and read **Splitwise** in `README.md` by its
`###`s: **Money is cents, everywhere**, **How a bill is divided, and the cent
that does not divide**, **Who may do what**, **The caps**, **Taking it out**.

What sessions here kept rediscovering:

- `data/split.json` is the one strings file besides `data/ui.json`: the same
  shape and the same ten languages, held by the validator to everything
  `ui.json` is held to and to sharing no key with it, so that taking the
  feature out is deleting files. It is a deliberate exception and the only
  one; the `/site` skill says why the flashcards were refused a third.
- Reading a group needs only its code — holding the link is the permission —
  and every write needs a session and a membership. `groupById()` and the
  header of `functions/api/split.js` are the rule. Of the six caps the route
  binds, the three a person types against — `MAX_NAME`, `MAX_WHAT`,
  `MAX_CENTS` — are restated in `assets/split.js`, and all six in the
  README's table under **The caps**; change one, change the others.
- The page answers at the root of `splitwise.tallinntastebuds.ee` and is not
  framed from the map: to a browser it is another site, with its own
  `localStorage`, which is why it carries a language switch of its own.
