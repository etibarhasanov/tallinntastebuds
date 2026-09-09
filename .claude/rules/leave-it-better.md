---
paths:
  - "assets/**"
  - "functions/**"
  - "tools/**"
  - "db/**"
  - "*.html"
---

# Leave the code better than you found it

This is the main rule of the repo, and it outranks "keep the diff small". It
is a path-scoped rule: Claude Code loads it the moment a session reads or
edits a file under the paths above, so it arrives with the code rather than
having to be remembered. Its last section is a process of its own, for a
session with nothing else to do.

Rubbish nobody's change happens to land on top of never gets cleaned, because
nothing ever quite touches it. So the rule reaches past the lines you edited —
but it reaches a measured distance, not an unbounded one:

| What you touched | What you read and fix |
|---|---|
| a function | **that whole function**, always, however you got there |
| the file it is in | **the whole file, if it is under ~600 lines** |
| a file over ~600 lines | the functions you touched, plus what they call and what calls them — not the rest |

`wc -l` settles which side of the line a file is on, and it is the only thing
that should — a list of big files written into this paragraph was wrong
within a week of being written: `functions/api/account.js` crossed the line
twice, over as the account grew and back under when the email reset came
out, and `functions/api/ask.js` arrived at nearly a thousand lines in a
single day. So do not trust a list; run this and read the answer:

```
wc -l assets/*.js assets/*.css functions/*.js functions/*/*.js tools/*.mjs *.html | sort -n | awk '$1 > 600'
```

Everything under the line is a few hundred lines a file and is meant to be
read in full while you are in it.

Do not "skim" a long file and report it as read. Say which functions you read.

Do not step around a mess to get to your line and leave it exactly as you found
it. "It was already like that" is not a reason — it is the reason it is still
like that.

In practice:

- **Duplication that already exists, three copies or more, is a function.** If
  a change would add another copy, write the function first and change one
  place instead of five. `toggleChip()` and `clearChips()` in `assets/app.js`
  are the worked example: four listeners were each doing the same toggle by
  hand, so it is written once. Note what made it right — the four copies were
  already there and the change was about to add a fifth. One caller, or a
  guess about future callers, is not this.
- **A comment that has stopped being true is a bug.** This codebase explains
  itself at length and that is only worth something while the explanations are
  accurate. If a change makes a paragraph wrong, rewrite the paragraph —
  README included. This is the other half of "do not strip or shorten existing
  comments": do not leave a stale one standing either.
- **A name that describes what something used to be is worth changing.** When a
  list stopped being a filter, `LIST_FILTER` went with it rather than staying
  as a constant that misled every reader after.
- **Dead things go** in the commit that orphaned them: an unused `ui.json` key
  in all ten languages, a CSS rule for an element nothing renders any more, a
  helper with no callers.
- **Refactoring and behaviour change belong in the same commit**, because the
  point is the state the file is left in. Do not open a follow-up for tidying
  the thing you were already standing in.

**The file is the boundary, and it is a limit as well as a licence.** Work that
would spread past it — a rename reaching forty files, a rewrite of a module you
only imported from, a schema this file happens to read — is a piece of work in
its own right and not something to slip into an unrelated PR. Name it and leave
it. What you may not do is notice it and say nothing, because then nobody
knows, and the next person to open the file starts the same discovery again.

## Cleaning means removing, not adding

This is the failure mode this rule creates if it is left unqualified, and it
has already happened here: told to improve things, a session starts inventing
helpers and scattering new methods through a file that did not ask for them.
That is not cleaning. It is the same mess with more names in it, and the next
person has to read every one of them before they can change anything.

So the bar for **adding** anything is higher than the bar for removing it:

- **A helper with one caller is not a helper.** Do not extract something used
  once. Do not extract because a function "feels long".
- **Extract from duplication that is already there**, counted — three or more
  real copies you can point at. Never from duplication you expect to arrive.
- **A cleanup that makes the file longer needs a reason you can say out loud.**
  The usual honest outcome of this pass is fewer lines, not more.
- **Do not reorganise for taste.** Moving functions around, renaming things
  that are already accurate, or restyling code to a preference is churn: it
  costs every reviewer a diff and buys nothing.

Deleting, on the other hand, needs no justification beyond the thing being
unused. If you can remove it and nothing breaks, remove it.

## Do not let this become the task

The pass is minutes of reading, not a project. If cleaning what you found is
turning into a bigger job than the change you came to make, stop: say what you
found and leave it. A session should be able to orient, do the thing it was
asked, tidy what it stood on, and finish — not disappear into the repo.

## Before the PR, read it again as a whole

Work arrives in pieces, and a change that was clean at each step is often not
clean as a whole: the third edit to a function makes the first one redundant,
a helper written for two callers ends up with one, a comment written before a
rethink now describes the version that lost the argument. None of that is
visible from inside the edit that caused it. It is only visible by going back.

So before opening a pull request, list the files it changes and read each one
again — at the reach the table above gives, so the whole file under ~600 lines
and the touched functions above it. **Read the files, not the hunks.** A diff
shows the lines that moved and hides the code they landed among, which is
exactly the wrong half for this. Then fix what that reading finds, in the same
PR: what your change made worse, and what was already wrong in what you read.

Coming back with "it can stay as it is" is a finding too, but it has to be the
result of having looked, and it should be said rather than left silent.

**Every line has to earn its place.** If you cannot say why a line, a helper,
a parameter, a class or a comment is there, it does not stay. Something added
"in case", a flag with one caller that is always the same value, a wrapper that
only forwards, a comment restating the line under it — each is a thing the next
person has to read and account for before they can change anything nearby.
Being able to delete something is a reason to delete it.

Ask it of each file as it now stands, rather than of the edits that got it
there. Whether a problem arrived with this change or was already sitting in the
file is a question about history, and the file does not care:

- Is anything duplicated — inside the file, or against something that already
  existed elsewhere?
- Is anything dead? Unreachable, uncalled, unread, unrendered. A `ui.json` key
  no page prints, a CSS rule for an element nothing draws, a helper whose last
  caller went years ago.
- Does every name describe what the thing is, rather than what it used to be or
  what it was partway through this change?
- Is every comment still true, and every README paragraph about anything in
  this file?
- Would a smaller version do the same job?

This pass is part of the work, not a review step somebody else performs. A PR
is the first time the change gets read as a whole, and it should not be the
first time for the person who wrote it.

## With nothing else to do, clean one file

A session that has finished what it was asked and has no next task should pick
one file and leave it better than it was. Not a sweep across the repo and not a
rename touching forty files — one file, read properly, improved, with a commit
message saying what changed and why it was worth changing.

The same standard applies as anywhere else, and **Cleaning means removing, not
adding** applies hardest here: a session with no task and an instruction to
improve something is exactly the situation that produces invented helpers
nobody asked for. If the file does not get shorter, be able to say why.

Behaviour stays identical, the validator passes, and anything with a visible
effect is driven in a browser before it is pushed. A cleanup that breaks
something is worse than the mess it tidied, and worse in a way nobody is
watching for, because the PR said it changed nothing.

Say plainly in the PR that this is what it is. A behaviour change carries its
own justification; a cleanup has to state one.

