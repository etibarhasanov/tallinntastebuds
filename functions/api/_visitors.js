/**
 * Tallinn Tastebuds — who came to the site, roughly, and what they did.
 *
 * /admin/visitors is drawn out of this file and nothing else. It answers the
 * questions — how many people came each day, how many had been before, from
 * which country and from where, which pages they read and for how long, and
 * what they pressed — out of the site's own database. Not to be confused
 * with ./_visits.js, which is the same idea for one person's /u/<name> and
 * is read by that person on /insights;
 * this is the whole site, and it is the owner's.
 *
 *   countArrive()   a page opened — called from POST /api/stats
 *   countLeave()    a page put away, with how long it was on screen and what
 *                   was pressed on it — the same
 *   readVisitors()  a range of it, for /admin/visitors — GET /api/admin/visitors
 *   readLive()      the last half hour, a minute at a time — GET /api/admin/live
 *   readFound()     how people found the site, over a range — GET /api/admin/found
 *   countAsk()      a question put to the chat on the map — called from
 *                   POST /api/ask
 *   countUse()      something done with one of the products — called from
 *                   the write routes of each
 *
 * A VISITOR IS A BROWSER'S FIRST PAGE OF THE DAY
 *
 * assets/track.js keeps one date in the browser, `ttb.seen`: the last day
 * this browser opened a page here. A page opened on a day that is not that
 * one is the browser's first today, and it says so with `first`; `back` is
 * whether there was an earlier day at all — by `ttb.since`, the first day it
 * came (arrive() in assets/track.js). That is the whole of it. No id is
 * sent, no address is read, no fingerprint is made, and nothing here could
 * tell one visitor from another if it tried: the table hears "a new visitor
 * today" or "a returning one" and adds one.
 *
 * What that costs in accuracy, said plainly. A browser with storage switched
 * off is never a visitor, only views — undercounted rather than counted on
 * every page. Two browsers are two visitors, a phone and a laptop of the same
 * person included, and clearing site data makes a returning visitor new
 * again. A cookie in place of the date would have every one of the same
 * limits. Bots mostly never reach it: a crawler that runs no script never
 * reaches this at all.
 *
 * The date is written on to the visitor's device, and whether that needs
 * asking first is a question about the law rather than about this file.
 * **No consent banner** and **Visitors** in README.md say where it stands.
 *
 * TIME IS TIME ON SCREEN
 *
 * The page counts the seconds it is visible — a tab in the background is not
 * somebody reading — and sends them when it is hidden or put away, together
 * with the presses it tallied meanwhile: one request per stretch on screen,
 * rather than one per press. A phone that kills a tab outright sometimes
 * takes its last stretch with it, so time and presses run slightly short and
 * never long. A stretch is capped at MAX_SECS, so a tab left open on a desk
 * all afternoon adds half an hour rather than five.
 *
 * WHERE THEY CAME FROM, AND THE COUNTRY
 *
 * Read the way ./_visits.js reads them — sourceOf() and countryOf() are that
 * file's — once per visitor per day, off the first page, so a visitor who
 * came from Instagram and then read six pages is one visitor from Instagram
 * rather than six.
 *
 * HOW THEY FOUND IT
 *
 * `from` says a visitor came from a search engine and stops there, and the
 * owner's question is what they searched for. That cannot be answered by
 * anybody's code: Google, Bing and the rest keep the words out of the
 * referrer, and browsers cut every referrer from another site down to its
 * origin unless that site asks otherwise. So /admin/found is drawn out of
 * what does arrive — `found`, the engine and the address a search visitor
 * landed on (FOUND BY A SEARCH ENGINE below), which is the nearest honest
 * stand-in for the words — and four more, each an OPEN kind capped like
 * the countries:
 *
 *   ref      `<host><path>` of a link on another site, off a visitor's
 *            first page of the day, where that site sent more than its
 *            origin — a thread, a post — and never its query
 *   tag      the `?from=` on a link — the owner's own on a link they
 *            shared, or `share`, which the site's Share buttons put on
 *            every link they hand out — on any page opened with one,
 *            since the tag is the point of the visit
 *            rather than the day's first page. assets/track.js takes it off
 *            the address once sent, so it is not shared onwards
 *   search   `<words>`: what was typed into one of the site's own search
 *            fields, once the typing settled — the `search` events the
 *            pages already report, caught by assets/track.js and
 *            carried on the report a page sends when it is put away
 *   nothing  the same words, where the field said it found nothing
 *
 * The words are lowercased, their spaces folded, cut at MAX_WORDS, and
 * dropped where they look like an address or a phone number rather than a
 * search. The chat's questions are not among them: a sentence to the chat is
 * a sentence somebody might put anything in, and it was left out on purpose.
 *
 * THE VIEWS THAT REPORTED
 *
 * A page says it opened as it opens, and how long it stayed only as it is
 * hidden or closed — and a phone that kills a tab outright never sends the
 * second report, so on the count's second day four map views in ten had a
 * view and no time. Dividing the seconds by every view then reads as a
 * shorter stay than anybody had. So a page's first put-away report is also
 * counted under `left`, one per page that reported at all, and the time
 * per view the owner reads is the seconds over those — and under `idle`
 * when that report carried no trail, which is a view on which nothing was
 * pressed and no place opened: the views where somebody looked and left.
 * Both come off the report the flows read, so they cost the page nothing.
 *
 * The first put-away report is sent the first time the page is hidden, not
 * the last, and on the flashcards — studied in short bursts, the phone put
 * down between two cards — that read six views in ten as idle that were not
 * all idle. So a page whose first report pressed nothing and whose later one
 * does says `woke`, once, and that takes the `idle` back: a count of -1
 * under the same kind, which the range sums like any other. Before
 * 2026-10-06 nobody took anything back, and idle reads high on those days.
 *
 * WHERE A VISIT BEGINS, AND WHERE IT GOES
 *
 * The page a browser's first view of the day was — `entry`, one per
 * visitor — says where people land, which the pages table cannot, since
 * the map is the most viewed page whether or not anybody arrives on it.
 * And the step a page names as the one before its first — the one the tab
 * carries across pages for the diagrams, THE ORDER THEY CAME IN in
 * assets/track.js — names the page before, so a first report whose step
 * before was on another page is counted once under `nav` as `from>to`. A
 * page reloaded is not a move, and a page opened in a fresh tab has no
 * step before and is not one either. Pages, not people, and the pair alone:
 * nothing here can lay one visitor's pages end to end.
 *
 * FOUND BY A SEARCH ENGINE
 *
 * `from` says how many visitors a search engine sent and `entry` which
 * page each visitor's day began on, but not the two together, and not
 * finely enough: every post on the blog is one page to `entry`, and so is
 * every place on the map. `found` is the answer to the question the blog's
 * posts about food were written for — did anybody search for bakeries in
 * Tallinn and land on the post about them — and it is counted once per
 * visitor, off the first page of the day, only when that visitor came from
 * a search engine. Its id is the engine and the address together, "google
 * /blog?post=…", with the query cut down to the one key that makes an
 * address a page of its own — ?post=, ?spot=, ?d= or ?lang= — so a
 * ?style= or a tracking tag does not split one page into many. The engine
 * is read off the referrer's host, which is all a search engine still
 * sends: never the words that were searched. Those are in Search Console
 * and Bing Webmaster Tools, and nowhere else. An open kind, capped like
 * the countries.
 *
 * WHICH LANGUAGE THE BROWSER ASKED FOR
 *
 * The site picks a language out of ?lang=, a saved choice or the browser's
 * own, and the `lang` kind below counts what it picked. A browser that
 * asked for a language the site does not speak is counted under English
 * there, so the question the owner actually has — is a language missing —
 * had no answer here. `asks` is the two letters of navigator.language, one
 * per visitor off the first page of the day, spoken or not: the languages
 * people arrive wanting, against the ten the site has. An open kind,
 * capped like the countries, since a browser may ask for anything.
 *
 * WHEN THEY COME, AND ON WHAT
 *
 * Every page opened is also counted under the hour of the day it was
 * opened in, `hour`, by Tallinn's clock rather than UTC, since the question
 * is when people in the city are looking and that is the clock the stories
 * and the opening hours already keep. Twenty-four rows a day at most. And
 * each visitor's first page of the day says what the browser is driven
 * with — `device`, phone, tablet or desktop, decided in assets/track.js
 * from the primary pointer and the width — because the layouts are drawn
 * for a 390px phone first, and how much of the traffic that is was a guess.
 *
 * THE OWNER IS NOT ONE OF THEM
 *
 * A report that arrives with the owner's own session — an account ADMINS
 * in wrangler.toml names, adminUser() in ./_admin.js — is not counted at
 * all, by ./stats.js before it reaches this file, into neither this table
 * nor flow_counts. On the count's first days a few returning browsers,
 * the owner's among them, were most of the returning visitors' minutes
 * and presses, and a page about who comes to the site should not be read
 * through the person who built it. Signed out, the owner is a visitor
 * like anybody.
 *
 * NEW AGAINST RETURNING
 *
 * A visitor is new on the first day its browser ever came and returning on
 * every day after, and assets/track.js says which on every page, as `who`,
 * out of the first day it keeps in `ttb.since`. Everything a visit does is
 * then counted a second time under the `cohort` kind, `<who>:<fact>`, so the
 * page can say what a new visitor does against a returning one — pages,
 * seconds, presses, places opened, sign-ins and accounts made (FACTS below).
 * The visitors themselves are the `visitor` kind's two ids, already there.
 *
 * These began after the visitors did, so the days before the first `cohort`
 * row have visitors and nothing to divide among them. The reader counts only
 * the days that have both — see readVisitors() — and says from when.
 *
 * THE LANGUAGE IT WAS READ IN
 *
 * Under the `lang` kind, each split by new and returning the way `cohort`
 * is: `<who>:<code>`, a visitor by the language their first page today
 * arrived in — the one on screen before any switch, which is the one the
 * site chose for them — and `<who>:secs:<code>`, the seconds on screen read
 * in it. And `<from>><to>`, a press of a language switch, so somebody who
 * arrived in English and read on in Russian is one visitor in English, their
 * minutes split between the two, and one `en>ru`. All of it rides on the
 * report a page sends when it is put away, and every code is checked against
 * the languages data/ui.json speaks, so the kind is a closed list: four rows
 * a language a day at the most, and a row per pair somebody pressed.
 *
 * THE TWO RAILS
 *
 * The map deals a stranger one of two rails, and **The short rail** in
 * README.md is why. The same facts are counted a third time per rail and
 * per kind of visitor, under the `layout` kind as `<rail>:<who>:<fact>`, and
 * the visitors on each rail as `<rail>:new` and `<rail>:back`. Only a
 * browser that has been dealt one is counted there — one that has never
 * opened the map has not, and filing it under the full rail by default would
 * be comparing the short rail against everybody. Since 2026-10-06 only a
 * newcomer on a phone is dealt one — a desktop or a tablet with no rail yet
 * draws the full one undealt, pickLayout() in assets/app.js — so from then
 * the strangers on each rail are phones alone. How
 * many strangers were
 * dealt each and how many opened a place on that first visit is press_counts'
 * and ./stats.js's, and ./admin/visitors.js reads it beside this.
 *
 * THE FOUR COLOURS
 *
 * Somebody new is dealt one of the four styles as their first page opens —
 * dealStyle() in assets/track.js, **The four styles, dealt** in README.md —
 * and the same facts are counted a fourth time per colour and per kind of
 * visitor, under the `style` kind as `<colour>:<who>:<fact>`, with the
 * visitors dealt each as `<colour>:new` and `<colour>:back`. Only a browser
 * that was dealt a colour is counted here, the rails' rule: one that chose
 * a colour, or arrived on a link carrying one, is in no arm. This is what
 * says which colour people stay longest in and open most under, which the
 * deal's own counts in press_counts — dealt, opened, back, changed — cannot:
 * those are one fact per browser, these are every visit.
 *
 * TIME ON PHONES
 *
 * How long somebody new spends on a phone, by the rail and the colour they
 * were dealt together — the question neither test's card answers alone,
 * since each mixes phones with desktops, which always draw the full rail.
 * Under the `phone` kind, `<rail>:<colour>:visitors` once on a newcomer's
 * first page of the day and `<rail>:<colour>:secs` on every report after,
 * the rail `a`, `b` or `none` for one not dealt yet. The arm is not read
 * off each report but pinned by assets/track.js on that first page and
 * carried all day — pinPhone() there says why — so a visitor and their
 * minutes are always in the same cell. New visitors only, on phones only,
 * and only under a dealt colour: PHONE_ARMS is the closed list, twelve arms
 * and two facts. It began counting the day it shipped and nothing before
 * that can be split by device, because the time was never filed with one.
 *
 * BY DEVICE
 *
 * Every fact a page reports is counted twice: once as it always was, and
 * once more under its device, the kind written `<device>.<kind>` — so
 * `phone.view`, `desktop.press`, `tablet.layout` — with the id and the
 * number the same. The device is the one assets/track.js reads off the
 * primary pointer and the width, and both reports carry it. No kind had a
 * dot in it before, so a row without one is every device together and a
 * row with one is one device, in the same table and under the same key,
 * and no schema moved. /admin/visitors, /admin/found, /admin/stats and
 * /admin/flows each read either half, by `?device=`, through forDevice()
 * below and its likes in ./_flows.js and ./stats.js.
 *
 * It doubles the rows a report writes and the size of a day, which is
 * still bounded by the kinds rather than the traffic: an OPEN kind is
 * capped per device as it is overall, by its own kind. Two kinds are not
 * filed again — `device`, which would only say a phone is a phone, and
 * `phone`, which is phones already — and nor is anything counted by a
 * route rather than a page, since no route knows the device: the chat
 * (`ask`), the products (`use`), the Google round trip's steps of signing
 * up and Right now. A device's view shows those for every device, and
 * says so. It began on 2026-10-06, the day the map stopped dealing a rail
 * to newcomers on a laptop or a tablet, and nothing before it can be split.
 *
 * WHAT THE CHAT WAS ASKED
 *
 * The chat on the map — **Ask for somewhere** in README.md — is the one
 * thing on the site a press name cannot measure: `ask` says a question was
 * sent, and nothing says whether it was answered. So ./ask.js counts each
 * question itself, under the `ask` kind, once the answer has gone: `asked`,
 * then exactly one of ENDINGS — `places`, `words`, `none` or `resting` —
 * and beside them `followup` for a question with earlier turns in its
 * thread, `near` for one measured from somewhere, `retry` where the rules
 * sent the model back for a second answer, and `mine` and `google`, how
 * many of the picks came off each roll. Ten ids a day at the most, from a
 * list written here, and never the words of the question, for the reason
 * HOW THEY FOUND IT leaves them out: a count of how often the chat answered
 * is what the weekly question needs. It runs on the server rather than in the page
 * because an answer the page never drew — a tab closed while the model
 * thought — was still a question asked and still Neurons spent, and
 * `resting` is the count of how often the day's allowance ran out.
 *
 * WHAT IT WAS ABOUT
 *
 * A press name says what was done and never to what: `story_view` is a
 * story come up, and which one is a parameter this table does not keep. So for the four things the owner makes and wants to know the
 * reach of, a page also says which, through TTBTrack.about() in
 * assets/track.js, once per thing per load, on the report it next sends —
 * and it is counted under the `about` kind as `<what>:<id>`:
 *
 *   story     a story came up on the map
 *   watched   ... and was watched to the end, as story_watch judges it
 *   post      a post on the blog was read, however the reader arrived at it
 *   deck      a deck, a grammar lesson, a song or a conversation opened on the flashcards —
 *             never a deck of somebody's own, which is theirs alone
 *   pass      a discount's pass was put in front of somebody on deal.html,
 *             a deal switched on only
 *   verified  the staff's scan of one said yes, on verify.html
 *
 * Every id is checked against the file the site ships it in — ABOUT says
 * which — so the kind is a closed list the size of what there is, never
 * whatever a request says, and a story taken down stops being counted with
 * it. Nothing about who: a thing opened, a day, a number.
 *
 * WHAT THE PRODUCTS WERE USED FOR, AND BY HOW MANY
 *
 * Most of the site's tables hold what is there now rather than what
 * happened: an unsaved place is a deleted row, and a flashcard reviewed
 * twice is one row with the second date on it. So "how much were lists used
 * last week" had no answer, and "how many different people used the
 * flashcards" had none anywhere. countUse() answers both, from the write
 * routes of the five products those tables cannot speak for — saves,
 * lists, flashcards, splitwise and chess — once a write has succeeded:
 *
 *   `use`         `<product>:<action>`, a day's count of each thing done —
 *                 `lists:add`, `flashcards:knew`, `splitwise:spend`, the
 *                 action named as the route names it
 *   usage_people  one row per person per product per week, so a week's
 *                 rows for a product are how many people used it. The row
 *                 is a key and nothing else: an HMAC under SAVE_SALT of the
 *                 week, the product and the account or device id, cut to
 *                 32 hex, so it cannot be turned back into who, and it is a
 *                 different key every week and for every product — the
 *                 table cannot be joined into what one person did, or into
 *                 whether they came back
 *
 * A person is the account where there is a session and the device id where
 * there is not, so somebody signed out who signs in during the week counts
 * twice that week, and so does one person on two devices signed out — the
 * limit the visitors have too. The owner is left out, by the session, the
 * way ./stats.js leaves them out. Without the salt the people are not
 * counted at all rather than filed under an id anybody could read; the
 * actions still are. The weeks begin on Monday, UTC.
 *
 * Accounts made, sign-ins and feedback are not here because their tables
 * already keep a dated row for each, and the chat's questions are
 * WHAT THE CHAT WAS ASKED.
 *
 * WHAT IS BOUNDED, AND HOW
 *
 * One row per fact per day, like profile_counts: a busy day and a quiet one
 * with the same pages in them are the same number of rows. The pages, the
 * visitor kinds, the rails and the facts counted under them are lists
 * written here — forty ids a day at the most between the `cohort` and
 * `layout` kinds, another sixty-four for `style`, and ten for `ask` — and so
 * are the steps of SIGNING UP,
 * a page's worth of them for each page that has a form; the languages are
 * the ones data/ui.json speaks, and WHAT IT WAS ABOUT is the stories, posts,
 * decks and deals the site ships. The countries, the sources, the presses,
 * the languages browsers ask for, `found` and the four kinds of HOW THEY
 * FOUND IT are not — a host, a press name or a search is whatever the
 * request says — so each of those kinds takes at most MAX_IDS ids a day,
 * the presses MAX_PRESS_IDS, and past that only ids already counted that
 * day go up. A press name must also be shaped like one, which every name
 * TTBTrack sends is, and a report carries at most MAX_NAMES of them.
 *
 * SIGNING UP
 *
 * Accounts made and sign-ins are two numbers, and two numbers cannot say
 * why the people who opened the sign-in sheet and did not come out of it
 * with an account did not. So every step of it is a press name of its own,
 * reported from the sheet on the map and the forms on splitwise and the
 * flashcards — SIGNUP below is the whole list — and counted a second time
 * under the `signup` kind as `<page>:<name>`:
 *
 *   account_nudge_shown, _faded      the offer over the map, and it going
 *                                    away unanswered; account_from_nudge is
 *                                    it taken
 *   account_from_<door>              what put the sheet up: the rail, the
 *                                    offer, a discount, a list to keep, a
 *                                    session that ran out under a press, a
 *                                    link from another page, the way back
 *                                    from Google
 *   account_sheet_<view>             the sheet up, on 'up' (make one), 'in'
 *                                    or 'google' (naming a Google account)
 *   account_try_<view>               its button pressed
 *   account_err_<error>              refused, and the word the route said —
 *                                    TTBTrack.refused() in assets/track.js
 *   account_done_<view>              an account made or signed into
 *   account_leave_<view>             the sheet shut with neither
 *   account_left_err                 ... with a refusal on screen as it went
 *
 * and, counted by ./google.js rather than by a page, since a page that has
 * sent somebody to Google cannot see what happened there:
 *
 *   google_out                       sent to Google to sign in
 *   google_back_<word>               back, and how: `in`, `name` (a new
 *                                    Google account, sent to pick a name),
 *                                    `cancel` (Cancel on Google's screen)
 *                                    or `failed`
 *
 * The difference between google_out and the backs is the people who never
 * came back from Google's screen at all.
 *
 * A closed list of its own rather than the `press` kind, because sign-up
 * names are rare ones that arrive late in a visit and late in the day,
 * which is exactly what a cap drops: the presses were capped at a hundred
 * names a day and twenty a report when this began, the busiest day came
 * within fourteen of the first, and a long visit to the map passed the
 * second. Both caps sit higher now — MAX_PRESS_IDS and MAX_NAMES — but
 * these are still picked out of the whole report rather than out of its
 * first MAX_NAMES, along with the sign-ins and accounts made that NEW
 * AGAINST RETURNING counts. Nothing typed is in any of it: the error is one
 * of the words ./account.js answers, and a word not on the list is not
 * counted here. A name also rides on the press kind as every press does,
 * and Clarity hears it as a custom event. Pages, not people,
 * as everything here is: a funnel of counts, never one person's way through.
 *
 * THE LAST HALF HOUR
 *
 * visitor_counts has a day as its finest grain, and "who is on the site right
 * now" wants a minute. So every page opened is also counted once into
 * visitor_live, a row per minute — and only sixty rows ever: a minute's row
 * is slot minute % 60, and the first page of a new minute takes the slot over
 * from the one an hour before, resetting its count. Nothing is deleted and
 * nothing needs pruning, the table can never grow, and it costs one write a
 * page opened and nothing per minute a page stays open.
 *
 * What it counts is pages opened, not people: somebody opening three pages
 * in five minutes is three. Telling people apart would take an id, and none
 * is made — A VISITOR IS A BROWSER'S FIRST PAGE OF THE DAY. At this site's
 * size it is a fair reading of how busy it is right now, which is what the
 * card on /admin/visitors is for.
 *
 * WHAT A FAILURE LOOKS LIKE
 *
 * Nothing, on either side. The tables arrive by hand; until they have, a
 * count answers false and /admin/visitors says the numbers are not in yet —
 * or, for visitor_live alone, leaves the card for the last half hour out.
 * The live count is its own statement rather than part of the day's batch,
 * because a batch is one transaction and a missing visitor_live would take
 * the day's facts down with it.
 */

import { sourceOf, siteOf, countryOf, networkName, today, dayBack } from './_visits.js';
import { languageIndex, dataFile, hmacHex } from './_lib.js';
import { adminIds } from './_admin.js';

/* The ranges the page offers, in days. 1 is today so far. The three routes
   that read a range — /api/admin/visitors, /found and /flows — answer any
   other as 7. */
export const SPANS = [1, 7, 28, 90];

/* The pages worth telling apart, each with the string data/ui.json already
   names it by where there is one. A page is known by its address, and the
   two subdomains by their host, since both answer at the root. An address
   none of them claims is the not-found page — pageOf() says why — and
   /admin/ sends nothing at all, since the only visitor there is the owner.
   Exported for tools/validate.mjs, which holds every `page:` and `view:`
   signal in data/flows.json to these ids, and every page that loads
   assets/track.js to being named here: a page left out would be counted as
   not found. */
export const PAGES = [
  { id: 'map', label: 'visitorsPageMap', paths: ['/', '/index.html'] },
  { id: 'lists', label: 'listsAllTitle', paths: ['/lists'] },
  { id: 'mine', label: 'visitorsPageMine', paths: ['/lists.html'] },
  { id: 'list', label: 'visitorsPageList', prefix: '/list/' },
  { id: 'profile', label: 'visitorsPageProfile', prefix: '/u/' },
  { id: 'blog', label: 'blogTitle', paths: ['/blog', '/blog.html'] },
  { id: 'chess', label: 'chessEyebrow', paths: ['/chess', '/chess.html'] },
  { id: 'flashcard', label: 'flashDoor', paths: ['/flashcard', '/flashcard.html'], host: 'flashcard.' },
  { id: 'split', label: 'visitorsPageSplit', paths: ['/split', '/split.html'], host: 'splitwise.' },
  { id: 'account', label: 'accountOpen', paths: ['/account', '/account.html'] },
  { id: 'edit', label: 'visitorsPageEdit', paths: ['/edit', '/edit.html'] },
  { id: 'write', label: 'writeTitle', paths: ['/write', '/write.html'] },
  { id: 'insights', label: 'insightsTitle', paths: ['/insights', '/insights.html'] },
  { id: 'feedback', label: 'feedbackTitle', paths: ['/feedback', '/feedback.html'] },
  { id: 'deal', label: 'passTitle', paths: ['/deal', '/deal.html'] },
  { id: 'verify', label: 'verifyTitle', paths: ['/verify', '/verify.html'] },
  { id: 'staff', label: 'visitorsPageStaff', paths: ['/staff', '/staff.html'] },
  /* 404.html, which Pages serves at any address nothing else answers. It
     says /404 itself, through data-page on its track.js tag, because the
     address it is read at is whatever somebody mistyped. */
  { id: 'missing', label: 'visitorsPageMissing', paths: ['/404', '/404.html'] },
  { id: 'privacy', label: 'privacyLink', paths: ['/privacy', '/privacy.html'] }
];

/* The two rails, as pickLayout() in assets/app.js deals them. */
const RAILS = ['a', 'b'];
/* The four colours a newcomer may be dealt — STYLE_DEALS in assets/track.js,
   STYLE_ARMS in ./stats.js. THE FOUR COLOURS. */
const COLOURS = ['red', 'green', 'blue', 'plum'];

/* New and returning — see NEW AGAINST RETURNING. */
const WHO = ['new', 'back'];

/* What is counted per kind of visitor and per rail: pages opened, seconds
   on screen, presses, places opened on the map, sign-ins and accounts made.
   The last two are presses already, picked out of a report by SIGNS. */
const FACTS = ['views', 'secs', 'presses', 'places', 'login', 'signup'];
const SIGNS = { account_login: 'login', account_create: 'signup' };

/* Every step of signing up that is counted under the `signup` kind — see
   SIGNING UP. The errors are the words functions/api/account.js answers a
   sign-in, a sign-up or a Google name with, dashes as underscores, plus
   `network` for a request that never came back and `generic` for one that
   came back saying nothing. */
const SIGN_VIEWS = ['up', 'in', 'google'];
const SIGNUP = new Set([
  'account_nudge_shown', 'account_nudge_faded', 'account_left_err',
  ...['rail', 'nudge', 'deal', 'keep', 'expired', 'link', 'google'].map((d) => 'account_from_' + d),
  ...['sheet', 'try', 'done', 'leave'].flatMap((step) => SIGN_VIEWS.map((v) => 'account_' + step + '_' + v)),
  ...['taken', 'username', 'password', 'no_match', 'slow_down', 'no_pending', 'linked',
    'malformed', 'no_database', 'no_salt', 'wrong_database', 'network', 'generic'].map((e) => 'account_err_' + e),
  'google_out',
  ...['in', 'name', 'cancel', 'failed'].map((w) => 'google_back_' + w)
]);

/* The kinds whose ids nobody chose from a list, and how many ids a day each
   may hold — see WHAT IS BOUNDED. A hundred countries in a day would be a
   good day, and so would a hundred different searches. The presses are the
   one open kind whose ids the site writes itself, and their cap has to sit
   above every name the pages can send, or it drops exactly the rare, late
   names worth counting: it was a hundred, the busiest day came within
   fourteen of it, and the pages send a little over two hundred names — the
   table under **Analytics** in README.md is the list. */
const OPEN = new Set(['country', 'from', 'press', 'asks', 'found', 'ref', 'tag', 'search', 'nothing']);
const MAX_IDS = 100;
const MAX_PRESS_IDS = 300;

/* The language a browser asks for, as the two letters of navigator.language
   — WHICH LANGUAGE THE BROWSER ASKED FOR — and the longest step a page may
   name as the one before its first, which is a path with a word in front. */
const CODE = /^[a-z]{2}$/;
const MAX_STEP = 200;

/* The twelve cells of TIME ON PHONES: each rail, or none yet, by each
   colour. */
const PHONE_ARMS = ['a', 'b', 'none'].flatMap((rail) => COLOURS.map((colour) => rail + ':' + colour));

/* What a browser is driven with, as assets/track.js decides it — WHEN THEY
   COME, AND ON WHAT. */
export const DEVICES = ['phone', 'tablet', 'desktop'];

/* The kinds not filed a second time by device, and the ones a device's view
   reads for every device because only a route counts them — BY DEVICE. */
const ANY_DEVICE = new Set(['device', 'phone']);
const SHARED = new Set(['ask', 'use']);

/* The device a report says it was made on, or null. */
function deviceOf(body) {
  return DEVICES.includes(body.device) ? body.device : null;
}

/* The `?device=` an admin route was asked for, or null for every device. */
export function askedDevice(params) {
  const asked = params.get('device');
  return DEVICES.includes(asked) ? asked : null;
}

/* visitor_counts rows as one device's view sees them — its own, their kind
   stripped back, the SHARED kinds as they are, and TIME ON PHONES for the
   phones, which is phones already — or, with no device, the rows of every
   device together. BY DEVICE. */
export function forDevice(rows, device) {
  if (!device) return rows.filter((r) => !r.kind.includes('.'));
  const at = device + '.';
  const out = [];
  for (const r of rows) {
    if (r.kind.startsWith(at)) out.push({ ...r, kind: r.kind.slice(at.length) });
    else if (SHARED.has(r.kind) || (r.kind === 'phone' && device === 'phone')) out.push(r);
  }
  return out;
}

/* How a question to the chat ended, as `source` in ./ask.js's answer says
   it — WHAT THE CHAT WAS ASKED: places drawn, a sentence and no places,
   nothing (no model, or an answer that could not be read), and resting
   (the day's allowance spent). */
const ENDINGS = ['places', 'words', 'none', 'resting'];

/* What a page can say it was about — WHAT IT WAS ABOUT — each with the file
   whose ids it is held to, and the most one report may carry. */
const ABOUT = {
  story: '/data/stories.json',
  watched: '/data/stories.json',
  post: '/data/blog.json',
  deck: '/data/decks/index.json',
  pass: '/data/deals.json',
  verified: '/data/deals.json'
};
const MAX_ABOUT = 20;

/* The products countUse() is called for — WHAT THE PRODUCTS WERE USED FOR,
   AND BY HOW MANY. `map` is the saves, which are made on the map. */
const PRODUCTS = ['map', 'lists', 'flashcards', 'splitwise', 'chess'];

/* The most one stretch on screen may add — see TIME IS TIME ON SCREEN — and
   the most presses one report may carry, by name and in all. Sixty names,
   because twenty was passed by an ordinary long visit to the map, which can
   send over a hundred, and a name past the cap was simply not counted. */
export const MAX_SECS = 1800;
const MAX_NAMES = 60;
const MAX_PRESS = 50;
const PRESS = /^[a-z][a-z0-9_]{1,39}$/;

/* The `?from=` tag on a link, the longest page elsewhere kept as one
   that linked here, and the search fields whose words are counted — the
   `scope` each already reports under. HOW THEY FOUND IT. */
export const TAG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const MAX_REF = 120;
const SCOPES = ['map', 'find', 'google', 'lists', 'list'];
const MAX_WORDS = 40;
const MAX_SEARCHES = 10;

/* The last half hour — see THE LAST HALF HOUR. LIVE_SLOTS is the ring's
   size, and LIVE_SPAN how much of it the page is sent. */
const LIVE_SLOTS = 60;
const LIVE_SPAN = 30;
const LIVE_ADD =
  'INSERT INTO visitor_live (slot, minute, n) VALUES (?1, ?2, 1) ' +
  'ON CONFLICT(slot) DO UPDATE SET ' +
  'n = CASE WHEN visitor_live.minute = excluded.minute THEN visitor_live.n + 1 ELSE 1 END, ' +
  'minute = excluded.minute';

function minuteNow() {
  return Math.floor(Date.now() / 60000);
}

/* The hour of the day in Tallinn, '00' to '23' — the clock the site's
   opening hours and stories already keep, tallinnNow() in ./ask.js being
   the other reader of the zone. UTC where the runtime has no zone data,
   which it has not lacked yet. */
function hourNow() {
  let hour = new Date().getUTCHours();
  try {
    const said = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Tallinn', hour: '2-digit', hour12: false })
      .format(new Date());
    if (/^\d\d$/.test(said)) hour = Number(said) % 24;
  } catch (e) { /* no zone data */ }
  return (hour < 10 ? '0' : '') + hour;
}

const ADD =
  'INSERT INTO visitor_counts (day, kind, id, n) VALUES (?1, ?2, ?3, ?4) ' +
  'ON CONFLICT(day, kind, id) DO UPDATE SET n = visitor_counts.n + excluded.n';

/* The same, for an OPEN kind: a new id only while the day has room for one,
   the room being ?5. The EXISTS is a lookup on the key and comes first, so
   an id already counted today goes up without the day's ids being counted. */
const ADD_CAPPED =
  'INSERT INTO visitor_counts (day, kind, id, n) SELECT ?1, ?2, ?3, ?4 ' +
  'WHERE EXISTS (SELECT 1 FROM visitor_counts WHERE day = ?1 AND kind = ?2 AND id = ?3) ' +
  'OR (SELECT COUNT(*) FROM visitor_counts WHERE day = ?1 AND kind = ?2) < ?5 ' +
  'ON CONFLICT(day, kind, id) DO UPDATE SET n = visitor_counts.n + excluded.n';

function add(env, day, kind, id, n) {
  const own = kind.slice(kind.indexOf('.') + 1);
  if (!OPEN.has(own)) return env.DB.prepare(ADD).bind(day, kind, id, n);
  return env.DB.prepare(ADD_CAPPED).bind(day, kind, id, n, own === 'press' ? MAX_PRESS_IDS : MAX_IDS);
}

/* Which page a report is about, off the request's own host — the beacon is
   sent to the origin the page is on — and the path the page sends. Exported
   for ./_flows.js, which reads the same report a third way.

   An address no page claims is the not-found page. Pages answers a
   mistyped or out-of-date link with 404.html, which reports itself as /404
   and so is claimed above; what falls through to here is a report nothing
   on the site would send, and filing it as not found is the honest guess.
   It is filed somewhere rather than nowhere, because counting nothing loses
   more than a view: the page has already written today into ttb.seen, so
   every later page that day says it is not the first, and the visitor is
   never counted at all. This used to be the map, when the project had no
   404.html and Pages answered every unknown address with index.html.
   tools/validate.mjs holds every page that reports to being named in PAGES,
   so a page left out cannot hide here. */
export function pageOf(request, path) {
  const host = new URL(request.url).hostname;
  const at = String(path || '');
  const page = PAGES.find((p) =>
    (p.host && host.startsWith(p.host)) ||
    (p.paths && p.paths.includes(at)) ||
    (p.prefix && at.startsWith(p.prefix) && at.length > p.prefix.length));
  return page ? page.id : 'missing';
}

/* The step a page names as the one before its first — `page:/lists`,
   `view:/`, `save_place@/` — as the kind of step and the page it was on, or
   null where it cannot be read. THE ORDER THEY CAME IN in assets/track.js
   is how the tab carries it from one page to the next; ./_flows.js reads
   the kind, and WHERE A VISIT GOES reads the page. */
export function stepBefore(request, sent) {
  const text = typeof sent === 'string' && sent.length <= MAX_STEP ? sent : '';
  const m = /^(page|view):(.+)$/.exec(text) || /^([a-z][a-z0-9_]*)@(.+)$/.exec(text);
  return m ? { kind: m[1], page: pageOf(request, m[2]) } : null;
}

/* The rail the browser was dealt, or null where it has not been dealt one. */
function railOf(body) {
  return RAILS.includes(body.layout) ? body.layout : null;
}

/* The colour the browser was dealt, or null where it was not dealt one. */
function colourOf(body) {
  return COLOURS.includes(body.style) ? body.style : null;
}

/* The cell a phone newcomer was pinned to today, or null — TIME ON PHONES. */
function phoneOf(body) {
  return PHONE_ARMS.includes(body.phone) ? body.phone : null;
}

/* New or returning, or null where the browser could not keep the date. */
function whoOf(body) {
  return WHO.includes(body.who) ? body.who : null;
}

/* One fact about a visit, filed under its kind of visitor and, where it has
   them, under its rail and its colour as well — NEW AGAINST RETURNING, THE
   TWO RAILS and THE FOUR COLOURS. */
function split(facts, arms, who, fact, n) {
  if (!who || !(n > 0)) return;
  facts.push(['cohort', who + ':' + fact, n]);
  if (arms.rail) facts.push(['layout', arms.rail + ':' + who + ':' + fact, n]);
  if (arms.colour) facts.push(['style', arms.colour + ':' + who + ':' + fact, n]);
}

/* One batch of [kind, id, n] facts, today, and the same again under the
   device where the report named one — BY DEVICE. True when it was counted. */
async function file(env, facts, device) {
  const day = today();
  const all = device
    ? facts.concat(facts.filter(([kind]) => !ANY_DEVICE.has(kind)).map(([kind, id, n]) => [device + '.' + kind, id, n]))
    : facts;
  try {
    await env.DB.batch(all.map(([kind, id, n]) => add(env, day, kind, id, n)));
    return true;
  } catch (e) {
    /* No table yet, or the write failed. Nobody is waiting to hear it. */
    return false;
  }
}

/* The search engines a referrer may name, by the host it names — the same
   hosts sourceOf() in ./_visits.js files under `search` — and the query
   keys that make an address a page of its own. FOUND BY A SEARCH ENGINE. */
const ENGINES = [
  ['google', /(^|\.)google\.[a-z.]{2,6}$/],
  ['bing', /(^|\.)bing\.com$/],
  ['duckduckgo', /(^|\.)duckduckgo\.com$/],
  ['yandex', /(^|\.)yandex\.(ru|com)$/],
  ['ecosia', /(^|\.)ecosia\.org$/],
  ['yahoo', /(^|\.)search\.yahoo\.com$/]
];
const PAGE_KEYS = ['post', 'spot', 'd', 'lang'];
const MAX_FOUND = 120;

/* "google /blog?post=…" for a visitor a search engine sent to that address,
   or null when the referrer is not one of the engines or the address will
   not read. */
function foundOf(from, at) {
  let host = '';
  let url = null;
  try {
    host = new URL(String(from || '')).hostname.toLowerCase().replace(/^www\./, '');
    url = new URL(String(at || ''), 'https://x');
  } catch (e) {
    return null;
  }
  const engine = ENGINES.find(([, test]) => test.test(host));
  if (!engine || !url.pathname.startsWith('/')) return null;
  const key = PAGE_KEYS.find((k) => url.searchParams.has(k));
  const address = url.pathname +
    (key ? '?' + key + '=' + encodeURIComponent(url.searchParams.get(key)) : '');
  return (engine[0] + ' ' + address).slice(0, MAX_FOUND);
}

/* A page opened: `id` is its path, `first` and `back` what ttb.seen said,
   `who` what ttb.since said, `from` the referrer it was opened with, `at`
   its whole address, `layout` the rail if any, `asks` the language the
   browser asks for, `device` phone, tablet or desktop, and `tag` the
   `?from=` where the address had one. */
export async function countArrive(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);
  const arms = { rail: railOf(body), colour: colourOf(body) };

  const facts = [['view', page, 1], ['hour', hourNow(), 1]];
  split(facts, arms, whoOf(body), 'views', 1);
  if (body.first === true) {
    const who = body.back === true ? 'back' : 'new';
    const site = siteOf(request);
    const source = sourceOf(body.from, request.headers.get('user-agent'), site);
    facts.push(
      ['visitor', who, 1],
      ['country', countryOf(request), 1],
      ['from', source, 1],
      ['entry', page, 1]
    );
    if (arms.rail) facts.push(['layout', arms.rail + ':' + who, 1]);
    if (arms.colour) facts.push(['style', arms.colour + ':' + who, 1]);
    const found = foundOf(body.from, body.at);
    if (found) facts.push(['found', found, 1]);
    const ref = refOf(body.from, source, site);
    if (ref) facts.push(['ref', ref, 1]);
    if (CODE.test(body.asks)) facts.push(['asks', body.asks, 1]);
    if (DEVICES.includes(body.device)) facts.push(['device', body.device, 1]);
    const phone = phoneOf(body);
    if (phone) facts.push(['phone', phone + ':visitors', 1]);
  }
  const tag = typeof body.tag === 'string' ? body.tag.toLowerCase() : '';
  if (TAG.test(tag)) facts.push(['tag', tag, 1]);
  const [counted] = await Promise.all([file(env, facts, deviceOf(body)), countLive(env)]);
  return counted;
}

/* The page on another site that linked here — HOW THEY FOUND IT — as its
   host and path, or null: for a search engine, which `found` has, for this
   site itself, and for a referrer that is only an origin, which `from`
   already has. Never the query, which is where another site keeps its
   session ids and its tracking. */
function refOf(referrer, source, site) {
  let url;
  try {
    url = new URL(String(referrer || ''));
  } catch (e) {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (source === 'search' || host === site || host.endsWith('.' + site)) return null;
  if (!url.pathname || url.pathname === '/') return null;
  return (host + url.pathname).slice(0, MAX_REF);
}

/* The words typed into the site's own search fields — HOW THEY FOUND IT —
   off a report's `searches`, [{ scope, term, results }], `results` present
   only where the field knows how many it found. */
function searchFacts(body) {
  const facts = [];
  const sent = Array.isArray(body.searches) ? body.searches.slice(0, MAX_SEARCHES) : [];
  for (const s of sent) {
    if (!s || !SCOPES.includes(s.scope)) continue;
    const words = String(s.term || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_WORDS).trim();
    if (words.length < 2 || !/[\p{L}\p{N}]/u.test(words)) continue;
    /* An address or a phone number is somebody's, not a search. */
    if (/@/.test(words) || /\d[\d ]{5,}\d/.test(words)) continue;
    facts.push(['search', words, 1]);
    if (s.results === 0) facts.push(['nothing', words, 1]);
  }
  return facts;
}

/* The `about` facts a report carries — WHAT IT WAS ABOUT — each held to the
   ids of the file ABOUT names for it, which is read only when a report
   names something out of it, through the cache every data file is read
   through. */
async function aboutFacts(context, body) {
  const sent = Array.isArray(body.about) ? body.about.slice(0, MAX_ABOUT) : [];
  const shipped = {};
  const facts = [];
  for (const key of sent) {
    const at = typeof key === 'string' ? key.indexOf(':') : -1;
    const file = at > 0 ? ABOUT[key.slice(0, at)] : null;
    if (!file) continue;
    if (!shipped[file]) shipped[file] = idsIn(context, file);
    if ((await shipped[file]).has(key.slice(at + 1))) facts.push(['about', key, 1]);
  }
  return facts;
}

/* The ids a data file ships: the stories, the posts and the deals are an
   array each, and the flashcards' index — what tools/decks.mjs writes out
   of data/decks.json, a fraction of it — holds its decks, lessons, songs and
   conversations under four keys. None, where the file cannot be read. */
async function idsIn(context, file) {
  try {
    const doc = await dataFile(context, file);
    const rows = Array.isArray(doc) ? doc
      : [].concat(doc.decks || [], doc.lessons || [], doc.songs || [], doc.talks || []);
    return new Set(rows.filter((r) => r && typeof r.id === 'string').map((r) => r.id));
  } catch (e) {
    return new Set();
  }
}

/* One page opened, into this minute's slot — THE LAST HALF HOUR. */
async function countLive(env) {
  const minute = minuteNow();
  try {
    await env.DB.prepare(LIVE_ADD).bind(minute % LIVE_SLOTS, minute).run();
  } catch (e) {
    /* No visitor_live yet. The day's facts do not wait on it. */
  }
}

/* The last LIVE_SPAN minutes, oldest first, this one last and still
   filling: pages opened in each. Null where there is no table yet. */
export async function readLive(env) {
  const minute = minuteNow();
  let rows;
  try {
    rows = await env.DB.prepare('SELECT minute, n FROM visitor_live WHERE minute > ?')
      .bind(minute - LIVE_SPAN).all();
  } catch (e) {
    return null;
  }
  const minutes = new Array(LIVE_SPAN).fill(0);
  for (const r of rows.results || []) {
    const at = LIVE_SPAN - 1 - (minute - r.minute);
    if (at >= 0 && at < LIVE_SPAN) minutes[at] = r.n;
  }
  return minutes;
}

/* A stretch on screen ended: `secs` of it on the page at `id`, `presses`,
   { name: times }, what TTBTrack reported meanwhile, and `places`, how many
   views TTBTrack.view() reported in it — places opened on the map, which is
   the only page whose views are places: the blog's are posts and the
   flashcards' decks, and they are not counted as places. `langs` is the
   same seconds by language, { code: secs }, `moved` the switches pressed,
   { 'from>to': n }, and on a browser's first page today `first` is true and
   `lang` the language it arrived in. `opened` is true on a page's first
   report, `trail` the names pressed on it so far and `earlier` the step
   before — the three ./_flows.js reads, read here for THE VIEWS THAT
   REPORTED and WHERE A VISIT GOES. `searches` is what was typed into a
   search field, HOW THEY FOUND IT, and `about` what the page said it was
   about, ['<what>:<id>'] — WHAT IT WAS ABOUT. */
export async function countLeave(context, body) {
  const { request, env } = context;
  const page = pageOf(request, body.id);
  const arms = { rail: railOf(body), colour: colourOf(body) };
  const who = whoOf(body);

  const facts = [];
  if (body.opened === true) {
    facts.push(['left', page, 1]);
    if (!Array.isArray(body.trail) || !body.trail.length) facts.push(['idle', page, 1]);
    const before = stepBefore(request, body.earlier);
    if (before && before.page !== page) facts.push(['nav', before.page + '>' + page, 1]);
  } else if (body.woke === true && Array.isArray(body.trail) && body.trail.length) {
    /* A view counted idle on its first report that was used after all —
       THE VIEWS THAT REPORTED. Filed under today, which is the view's own day
       but for one that crossed midnight UTC; readVisitors() sums the range
       and holds a page's idle between nought and its left. */
    facts.push(['idle', page, -1]);
  }
  const secs = Math.min(MAX_SECS, Math.round(Number(body.secs) || 0));
  if (secs > 0) facts.push(['time', page, secs]);
  split(facts, arms, who, 'secs', secs);
  const phone = phoneOf(body);
  if (phone && secs > 0) facts.push(['phone', phone + ':secs', secs]);

  let pressed = 0;
  const presses = body.presses && typeof body.presses === 'object' ? body.presses : {};
  for (const name of Object.keys(presses).slice(0, MAX_NAMES)) {
    const n = Math.min(MAX_PRESS, Math.round(Number(presses[name]) || 0));
    if (!PRESS.test(name) || n < 1) continue;
    facts.push(['press', name, n]);
    pressed += n;
  }
  /* The steps of signing up, and the sign-ins and accounts they end in, out
     of the whole report rather than its first MAX_NAMES — they are the rare
     names that come late in a visit, which is what a cap drops. SIGNING UP. */
  const signs = { login: 0, signup: 0 };
  for (const name of Object.keys(presses)) {
    const n = Math.min(MAX_PRESS, Math.round(Number(presses[name]) || 0));
    if (n < 1) continue;
    if (SIGNUP.has(name)) facts.push(['signup', page + ':' + name, n]);
    if (SIGNS[name]) signs[SIGNS[name]] += n;
  }
  split(facts, arms, who, 'presses', pressed);
  split(facts, arms, who, 'login', signs.login);
  split(facts, arms, who, 'signup', signs.signup);
  if (page === 'map') split(facts, arms, who, 'places', Math.min(MAX_PRESS, Math.round(Number(body.places) || 0)));
  facts.push(...await languageFacts(context, body, who));
  facts.push(...searchFacts(body));
  facts.push(...await aboutFacts(context, body));

  return facts.length ? file(env, facts, deviceOf(body)) : false;
}

/* One step of signing up that no page can see — the Google round trip's,
   from ./google.js — filed under that route rather than under a page. */
export function countSignup(env, name) {
  if (!SIGNUP.has(name)) return Promise.resolve(false);
  return file(env, [['signup', 'google:' + name, 1]]);
}

/* A question put to the chat on the map and how it was answered — WHAT THE
   CHAT WAS ASKED. `ended` is one of ENDINGS, and the rest are what the
   answer was made of. Called by ./ask.js through waitUntil once the answer
   has gone, and never for the owner, whom that route leaves out the way
   ./stats.js does. */
export async function countAsk(env, { ended, followup, near, retried, mine, google }) {
  if (!ENDINGS.includes(ended)) return false;
  const facts = [['ask', 'asked', 1], ['ask', ended, 1]];
  if (followup) facts.push(['ask', 'followup', 1]);
  if (near) facts.push(['ask', 'near', 1]);
  if (retried) facts.push(['ask', 'retry', 1]);
  if (mine > 0) facts.push(['ask', 'mine', mine]);
  if (google > 0) facts.push(['ask', 'google', google]);
  return file(env, facts);
}

/* Something done with one of PRODUCTS — WHAT THE PRODUCTS WERE USED FOR,
   AND BY HOW MANY. `answer` is the route's own answer, or the promise of
   it, and is handed back as it is: a write route wraps each action as
   `return countUse(context, 'lists', action, create(...), user)`, and it
   is counted only where the answer says the write went through. `user` is
   the session's, `device` the device id a signed-out write is filed under.
   The counting runs through waitUntil, after the answer. */
export async function countUse(context, product, action, answer, user, device) {
  const res = await answer;
  if (!res || !res.ok || !PRODUCTS.includes(product)) return res;
  const { env } = context;
  if (user && adminIds(env).has(String(user.id).toLowerCase())) return res;
  const person = user ? 'user:' + user.id : device ? 'device:' + device : '';
  context.waitUntil(Promise.all([
    file(env, [['use', product + ':' + action, 1]]),
    countPerson(env, product, person)
  ]));
  return res;
}

/* This person, once this week, for this product — usage_people. Nothing
   without a person or without the salt, and nothing but a failed write
   where the table has not been applied yet. */
async function countPerson(env, product, person) {
  if (!person || !env.SAVE_SALT) return;
  const week = weekOf(today());
  try {
    const key = (await hmacHex(env.SAVE_SALT, 'use|' + week + '|' + product + '|' + person)).slice(0, 32);
    await env.DB
      .prepare('INSERT OR IGNORE INTO usage_people (week, product, key) VALUES (?, ?, ?)')
      .bind(week, product, key)
      .run();
  } catch (e) {
    /* No table yet. The action was still counted. */
  }
}

/* The Monday a YYYY-MM-DD day's week begins on, in the same form. */
function weekOf(day) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}

/* The `lang` facts a report carries — THE LANGUAGE IT WAS READ IN — with
   every code data/lang/index.json lists, which is every language data/ui.json
   speaks in a few hundred bytes rather than the whole of it. The file is read
   only when there is something to check, through the cache every data file
   is read through; where it cannot be read, nothing about language is
   counted. */
async function languageFacts(context, body, who) {
  const langs = body.langs && typeof body.langs === 'object' ? body.langs : {};
  const moved = body.moved && typeof body.moved === 'object' ? body.moved : {};
  const arrived = who && body.first === true;
  if (!arrived && !(who && Object.keys(langs).length) && !Object.keys(moved).length) return [];

  let spoken;
  try {
    spoken = new Set(Object.keys((await languageIndex(context)) || {}));
  } catch (e) {
    return [];
  }

  const facts = [];
  if (arrived && spoken.has(body.lang)) facts.push(['lang', who + ':' + body.lang, 1]);
  for (const code of who ? Object.keys(langs).slice(0, MAX_NAMES) : []) {
    const secs = Math.min(MAX_SECS, Math.round(Number(langs[code]) || 0));
    if (spoken.has(code) && secs > 0) facts.push(['lang', who + ':secs:' + code, secs]);
  }
  for (const pair of Object.keys(moved).slice(0, MAX_NAMES)) {
    const [from, to] = pair.split('>');
    const n = Math.min(MAX_PRESS, Math.round(Number(moved[pair]) || 0));
    if (spoken.has(from) && spoken.has(to) && from !== to && n > 0) facts.push(['lang', from + '>' + to, n]);
  }
  return facts;
}

/* ------------------------------------------------------------- reading */

/* The five figures a range adds up to. */
function blank() {
  return { visitors: 0, back: 0, views: 0, secs: 0, presses: 0 };
}

/* What one kind of visitor did — the visitors and every one of FACTS. */
function facts() {
  const out = { visitors: 0 };
  for (const f of FACTS) out[f] = 0;
  return out;
}

function tally(figures, kind, id, n) {
  if (kind === 'visitor') {
    figures.visitors += n;
    if (id === 'back') figures.back += n;
  } else if (kind === 'view') figures.views += n;
  else if (kind === 'time') figures.secs += n;
  else if (kind === 'press') figures.presses += n;
}

function bump(map, id, n) {
  map.set(id, (map.get(id) || 0) + n);
}

function most(map) {
  return [...map].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
}

/* Two counts of the same things side by side — a story that came up and was
   watched to the end, a pass shown and verified — as [{ id, <a>, <b> }],
   most of the first first. */
function paired(one, two, a, b) {
  return [...new Set([...one.keys(), ...two.keys()])]
    .map((id) => ({ id, [a]: one.get(id) || 0, [b]: two.get(id) || 0 }))
    .sort((x, y) => y[a] - x[a] || y[b] - x[b] || x.id.localeCompare(y.id));
}

/* One range, or null where there is no table yet. `ui` is the reading
 * language's block, which names the pages and the three networks.
 *
 *   span       1, 7, 28 or 90
 *   from       the first day of the range
 *   since      the first day anything was counted, or null for never
 *   split      the first day new and returning were told apart, or null
 *   now        { visitors, back, views, secs, presses } in the range
 *   before     the same over the range just before it; null for today,
 *              since a day half over set against a whole one says nothing
 *   today      { fresh, back, login, signup, rails } today so far, whatever
 *              the range, `rails` holding the same four for `a`, `b` and
 *              `none` — the visitors no rail has been dealt to yet
 *   unit       'day' or 'week' — what one bar is — or null for today
 *   series     [{ day, fresh, back }] visitors per bar, oldest first, zeros
 *              included; `day` is the first day the bar covers
 *   cohorts    [{ id, visitors, ...FACTS }] new and returning, over the
 *              days of the range that tell them apart
 *   colours    [{ id, visitors, back, ...FACTS, fresh }] the four colours,
 *              the same shape as the rails — THE FOUR COLOURS
 *   layouts    [{ id, visitors, back, ...FACTS, fresh }] the two rails over
 *              the same days, `fresh` being the rail's new visitors alone
 *   phones     [{ id, visitors, secs }] the twelve `<rail>:<colour>` cells
 *              of phone newcomers over the range — TIME ON PHONES
 *   pages      [{ id, name, views, secs, left, idle, secsLeft }] most
 *              viewed first: `left` the views that reported how they ended,
 *              `idle` the ones that reported nothing pressed, and `secsLeft`
 *              the seconds over the days that counted `left` — the
 *              numerator for a time per reported view, THE VIEWS THAT
 *              REPORTED
 *   entries    [{ id, name, n }] the page a visitor's day began on, most
 *              first
 *   found      [{ id: 'engine /address', n }] visitors a search engine
 *              sent, by the engine and the address they landed on, most
 *              first — FOUND BY A SEARCH ENGINE
 *   moves      [{ id: 'from>to', from, to, n }] pages opened one after the
 *              other in one tab, most first, `from` and `to` named
 *   countries  [{ id, n }] visitors, most first
 *   sources    [{ id, name?, n }] visitors, most first
 *   presses    [{ id, n }] most first
 *   languages  [{ id, visitors: { new, back }, secs: { new, back } }] by
 *              the language visitors arrived in, most first, then by time
 *   switches   [{ id: 'from>to', n }] language switches, most first
 *   asked      [{ id, n, spoken }] visitors by the language their browser
 *              asks for, most first, `spoken` whether the site has it —
 *              `spoken` is the codes data/lang/index.json lists
 *   hours      [24 numbers] page views by the hour of the day in Tallinn,
 *              midnight first
 *   devices    [{ id, n }] visitors by phone, tablet or desktop, most first
 *   signup     { name: n } every step of SIGNING UP in the range, over
 *              every page, and { } before it began
 *   made       [{ id, name, n }] accounts made or signed into through a
 *              form, account_done_*, by the page the form was on
 *   about      WHAT IT WAS ABOUT: { stories: [{ id, up, watched }],
 *              posts: [{ id, n }], decks: [{ id, n }],
 *              deals: [{ id, shown, verified }] }, each most first
 *
 * One read of the range and the one before it; the rest is arithmetic on at
 * most 180 days of a hundred-odd rows each.
 *
 * Who did what is counted only over the days that have `cohort` rows, and
 * the visitors divided among it only over the same days, so a range reaching
 * back past the day it began is not a week of visitors over two days of what
 * they did. A page's `secsLeft` is held to the days that have `left` rows
 * the same way, for the same reason. */
export async function readVisitors(env, span, ui, spoken, device) {
  const first = dayBack(2 * span - 1);
  const cut = dayBack(span - 1);
  const day = today();
  const at = device ? device + '.' : '';
  let rows;
  let since;
  let began;
  try {
    [rows, since, began] = await Promise.all([
      env.DB.prepare('SELECT day, kind, id, n FROM visitor_counts WHERE day >= ?').bind(first).all(),
      device
        ? env.DB.prepare('SELECT MIN(day) AS day FROM visitor_counts WHERE kind = ?').bind(at + 'view').first()
        : env.DB.prepare('SELECT MIN(day) AS day FROM visitor_counts').first(),
      env.DB.prepare('SELECT MIN(day) AS day FROM visitor_counts WHERE kind = ?').bind(at + 'cohort').first()
    ]);
  } catch (e) {
    return null;
  }
  rows = forDevice(rows.results || [], device);

  const now = blank();
  const was = blank();
  const byDay = new Map();
  const pages = new Map();
  const countries = new Map();
  const sources = new Map();
  const presses = new Map();
  const languages = new Map();
  const switches = new Map();
  const entries = new Map();
  const found = new Map();
  const moves = new Map();
  const asked = new Map();
  const devices = new Map();
  const signup = new Map();
  const made = new Map();
  const about = new Map(Object.keys(ABOUT).map((what) => [what, new Map()]));
  const hours = new Array(24).fill(0);
  const cohorts = new Map(WHO.map((id) => [id, { id: id, ...facts() }]));
  const rails = new Map(RAILS.map((id) => [id, { id: id, back: 0, ...facts(), fresh: facts() }]));
  const colours = new Map(COLOURS.map((id) => [id, { id: id, back: 0, ...facts(), fresh: facts() }]));
  const phones = new Map(PHONE_ARMS.map((id) => [id, { id: id, visitors: 0, secs: 0 }]));
  const quad = () => ({ fresh: 0, back: 0, login: 0, signup: 0 });
  const sofar = { ...quad(), rails: { a: quad(), b: quad(), none: quad() } };

  /* The days that tell new from returning, and the days that counted which
     views reported — see the note above. */
  const told = new Set(rows.filter((r) => r.kind === 'cohort').map((r) => r.day));
  const heard = new Set(rows.filter((r) => r.kind === 'left').map((r) => r.day));
  const PAGE_FACTS = { view: 'views', time: 'secs', left: 'left', idle: 'idle' };

  for (const r of rows) {
    const inside = r.day >= cut;
    tally(inside ? now : was, r.kind, r.id, r.n);
    if (r.day === day) countToday(sofar, r);
    if (!inside) continue;
    if (r.kind === 'visitor') {
      const d = byDay.get(r.day) || { fresh: 0, back: 0 };
      d[r.id === 'back' ? 'back' : 'fresh'] += r.n;
      byDay.set(r.day, d);
      if (told.has(r.day) && cohorts.has(r.id)) cohorts.get(r.id).visitors += r.n;
    } else if (PAGE_FACTS[r.kind]) {
      const p = pages.get(r.id) || { views: 0, secs: 0, left: 0, idle: 0, secsLeft: 0 };
      p[PAGE_FACTS[r.kind]] += r.n;
      if (r.kind === 'time' && heard.has(r.day)) p.secsLeft += r.n;
      pages.set(r.id, p);
    } else if (r.kind === 'entry') bump(entries, r.id, r.n);
    else if (r.kind === 'found') bump(found, r.id, r.n);
    else if (r.kind === 'nav') bump(moves, r.id, r.n);
    else if (r.kind === 'asks') bump(asked, r.id, r.n);
    else if (r.kind === 'device') bump(devices, r.id, r.n);
    else if (r.kind === 'phone') {
      const at = r.id.lastIndexOf(':');
      const cell = phones.get(r.id.slice(0, at));
      const fact = r.id.slice(at + 1);
      if (cell && (fact === 'visitors' || fact === 'secs')) cell[fact] += r.n;
    }
    else if (r.kind === 'signup') {
      const at = r.id.indexOf(':');
      const name = r.id.slice(at + 1);
      bump(signup, name, r.n);
      if (name.startsWith('account_done_')) bump(made, r.id.slice(0, at), r.n);
    }
    else if (r.kind === 'about') {
      const at = r.id.indexOf(':');
      const into = about.get(r.id.slice(0, at));
      if (into) bump(into, r.id.slice(at + 1), r.n);
    }
    else if (r.kind === 'hour') { if (hours[Number(r.id)] !== undefined) hours[Number(r.id)] += r.n; }
    else if (r.kind === 'country') bump(countries, r.id, r.n);
    else if (r.kind === 'from') bump(sources, r.id, r.n);
    else if (r.kind === 'press') bump(presses, r.id, r.n);
    else if (r.kind === 'lang') countLanguage(languages, switches, r);
    else if (r.kind === 'cohort') {
      const [who, fact] = r.id.split(':');
      if (cohorts.has(who) && FACTS.includes(fact)) cohorts.get(who)[fact] += r.n;
    } else if ((r.kind === 'layout' || r.kind === 'style') && told.has(r.day)) {
      const [arm, who, fact] = r.id.split(':');
      const into = (r.kind === 'layout' ? rails : colours).get(arm);
      if (!into || !WHO.includes(who)) continue;
      if (!fact) {
        into.visitors += r.n;
        if (who === 'back') into.back += r.n;
        else into.fresh.visitors += r.n;
      } else if (FACTS.includes(fact)) {
        into[fact] += r.n;
        if (who === 'new') into.fresh[fact] += r.n;
      }
    }
  }

  /* The visitors no rail has been dealt to yet are everybody less the two. */
  for (const f of ['fresh', 'back', 'login', 'signup']) {
    sofar.rails.none[f] = Math.max(0, sofar[f] - sofar.rails.a[f] - sofar.rails.b[f]);
  }

  return {
    span: span,
    from: cut,
    since: (since && since.day) || null,
    split: (began && began.day) || null,
    now: now,
    before: span > 1 ? was : null,
    today: sofar,
    ...bars(span, byDay),
    cohorts: [...cohorts.values()],
    layouts: [...rails.values()],
    colours: [...colours.values()],
    phones: [...phones.values()],
    pages: PAGES
      .filter((p) => pages.has(p.id))
      .map((p) => ({ id: p.id, name: pageName(ui, p.id), ...pages.get(p.id) }))
      /* A `woke` takes back what its first report counted, so the sum cannot
         honestly pass either end; one forged, or a range that begins between
         the two reports, could — THE VIEWS THAT REPORTED. */
      .map((p) => ({ ...p, idle: Math.min(Math.max(0, p.idle), p.left) }))
      .sort((a, b) => b.views - a.views),
    entries: most(entries).map((e) => ({ ...e, name: pageName(ui, e.id) })),
    found: most(found),
    moves: most(moves).map((m) => {
      const [from, to] = m.id.split('>');
      return { ...m, from: pageName(ui, from), to: pageName(ui, to) };
    }),
    asked: most(asked).map((a) => ({ ...a, spoken: (spoken || []).includes(a.id) })),
    hours: hours,
    devices: most(devices),
    signup: Object.fromEntries(signup),
    made: most(made).map((m) => ({ ...m, name: pageName(ui, m.id) })),
    about: {
      stories: paired(about.get('story'), about.get('watched'), 'up', 'watched'),
      posts: most(about.get('post')),
      decks: most(about.get('deck')),
      deals: paired(about.get('pass'), about.get('verified'), 'shown', 'verified')
    },
    countries: most(countries),
    sources: most(sources).map((s) => ({ ...s, name: networkName(s.id) })),
    presses: most(presses),
    languages: [...languages.values()].sort((a, b) =>
      (b.visitors.new + b.visitors.back) - (a.visitors.new + a.visitors.back) ||
      (b.secs.new + b.secs.back) - (a.secs.new + a.secs.back) || a.id.localeCompare(b.id)),
    switches: most(switches)
  };
}

/* A page named in the reading language, by the string PAGES gives it, or
   its id where the block has none. */
function pageName(ui, id) {
  const page = PAGES.find((p) => p.id === id);
  return (page && ui[page.label]) || id;
}

/* One `lang` row into the languages or the switches — see THE LANGUAGE IT
 * WAS READ IN for the three shapes of id. */
function countLanguage(languages, switches, r) {
  const parts = r.id.split(':');
  if (parts.length === 1) return bump(switches, r.id, r.n);
  const [who, fact, code] = parts.length === 2 ? [parts[0], 'visitors', parts[1]] : parts;
  if (!WHO.includes(who) || (fact !== 'visitors' && fact !== 'secs')) return;
  const l = languages.get(code) || { id: code, visitors: { new: 0, back: 0 }, secs: { new: 0, back: 0 } };
  l[fact][who] += r.n;
  languages.set(code, l);
}

/* One of today's rows into the Today card: visitors new and returning,
 * sign-ins and accounts made, in all and per rail. */
function countToday(into, r) {
  if (r.kind === 'visitor') {
    into[r.id === 'back' ? 'back' : 'fresh'] += r.n;
  } else if (r.kind === 'cohort') {
    const fact = r.id.split(':')[1];
    if (fact === 'login' || fact === 'signup') into[fact] += r.n;
  } else if (r.kind === 'layout') {
    const [rail, who, fact] = r.id.split(':');
    const arm = into.rails[rail];
    if (!arm || !WHO.includes(who)) return;
    if (!fact) arm[who === 'back' ? 'back' : 'fresh'] += r.n;
    else if (fact === 'login' || fact === 'signup') arm[fact] += r.n;
  }
}

/* The bars under the figures: a day each for seven and twenty-eight days, a
 * week each for ninety — ninety bars on a phone is a smear — and none for
 * today, which is one bar and says nothing the figures do not. A week is
 * counted back from today, so the newest is always whole, the way the line
 * on /insights counts them. */
function bars(span, byDay) {
  if (span === 1) return { unit: null, series: null };
  const per = span === 90 ? 7 : 1;
  const series = [];
  for (let end = Math.ceil(span / per) * per - 1; end >= 0; end -= per) {
    const bar = { day: dayBack(Math.min(end, span - 1)), fresh: 0, back: 0 };
    for (let back = end; back > end - per; back--) {
      if (back > span - 1) continue;
      const d = byDay.get(dayBack(back));
      if (d) { bar.fresh += d.fresh; bar.back += d.back; }
    }
    series.push(bar);
  }
  return { unit: per === 7 ? 'week' : 'day', series: series };
}

/* ------------------------------------------------------- how they found it */

/* The kinds /admin/found reads — HOW THEY FOUND IT — and `from`, which its
   figures are made of. */
const FOUND = ['from', 'found', 'ref', 'tag', 'search', 'nothing'];

/* The four figures a range adds up to: visitors from a search engine, from a
   link on another site, pages opened by a tagged link,
   and searches typed into the site's own fields. */
function foundBlank() {
  return { search: 0, sites: 0, tags: 0, searches: 0 };
}

/* One range of how people found the site, or null where there is no table.
 *
 *   span       1, 7, 28 or 90
 *   from       the first day of the range
 *   since      the first day any of it was counted, or null for never — the
 *              figures' `from` rows are older, and not what this asks
 *   now        { search, sites, tags, searches } in the range
 *   before     the same over the range before it; null for today
 *   engines    [{ id, n }] search visitors by engine, most first — the
 *              `found` rows added up by their engine
 *   lands      [{ id, engine, at, n }] the `found` rows themselves: where
 *              search visitors landed, and from which engine
 *   refs       [{ id, n }] pages on other sites that linked here
 *   tags       [{ id, n }] the tagged links, the owner's and `share`
 *   searches   [{ id, n, nothing }] words searched for here, `nothing`
 *              being how many of those times the field found nothing */
export async function readFound(env, span, device) {
  const first = dayBack(2 * span - 1);
  const cut = dayBack(span - 1);
  const at = device ? device + '.' : '';
  const kinds = FOUND.map((k) => at + k);
  const marks = kinds.map(() => '?').join(', ');
  const began = ['found', 'ref', 'tag', 'search'].map((k) => at + k);
  let rows;
  let since;
  try {
    [rows, since] = await Promise.all([
      env.DB.prepare(`SELECT day, kind, id, n FROM visitor_counts WHERE day >= ? AND kind IN (${marks})`)
        .bind(first, ...kinds).all(),
      env.DB.prepare('SELECT MIN(day) AS day FROM visitor_counts WHERE kind IN (?, ?, ?, ?)').bind(...began).first()
    ]);
  } catch (e) {
    return null;
  }
  rows = { results: forDevice(rows.results || [], device) };

  const now = foundBlank();
  const was = foundBlank();
  const engines = new Map();
  const lands = new Map();
  const refs = new Map();
  const tags = new Map();
  const searches = new Map();
  const nothing = new Map();
  const into = { found: lands, ref: refs, tag: tags, search: searches, nothing: nothing };

  for (const r of rows.results || []) {
    const figures = r.day >= cut ? now : was;
    if (r.kind === 'from') {
      if (r.id === 'search') figures.search += r.n;
      else if (r.id !== 'here' && r.id !== 'direct') figures.sites += r.n;
    } else if (r.kind === 'tag') figures.tags += r.n;
    else if (r.kind === 'search') figures.searches += r.n;
    if (r.day < cut || !into[r.kind]) continue;
    bump(into[r.kind], r.id, r.n);
    if (r.kind === 'found') bump(engines, r.id.split(' ')[0], r.n);
  }

  return {
    span: span,
    from: cut,
    since: (since && since.day) || null,
    now: now,
    before: span > 1 ? was : null,
    engines: most(engines),
    lands: most(lands).map((l) => {
      const gap = l.id.indexOf(' ');
      return { ...l, engine: l.id.slice(0, gap), at: l.id.slice(gap + 1) };
    }),
    refs: most(refs),
    tags: most(tags),
    searches: most(searches).map((s) => ({ ...s, nothing: nothing.get(s.id) || 0 }))
  };
}
