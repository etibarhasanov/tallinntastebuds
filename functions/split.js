/**
 * Tallinn Tastebuds — /split, and what a group's link looks like in a message.
 *
 * SPLITWISE. This whole file is that feature's; deleting it is one of the
 * steps in **Taking it out** under **Splitwise** in README.md, and nothing
 * outside the feature imports from it.
 *
 * WHY IT EXISTS
 *
 * A group's link is not a page anybody browses to. It is a thing one person
 * pastes into a message and four other people tap — so what arrives in that
 * message is most of what the link is. Pasted as a static page it arrived as
 * "Splitwise | Tallinn Tastebuds", or as a bare blue URL, which tells the four
 * people nothing they did not already know and looks like a link to the map.
 *
 *   the card now says   "Split in Berlin"          and the mark beside it
 *   the tab says        "Split in Berlin"          and not the site's name
 *
 * None of that is possible from a static file. A static page has one title in
 * its head, and the crawler that builds the little card in WhatsApp, Telegram
 * or Slack does not run the script that would change it. So this Function
 * serves the page instead: it fetches split.html out of the deployment and
 * swaps the block between the <!--PAGE-HEAD--> markers for that group's own
 * tags. It is still split.html — one page, one script, one stylesheet, handed
 * back with a different head rather than a second copy of the markup that
 * would go stale the first time the other one changed.
 *
 * It is the same argument functions/list/[id].js makes for a shared list, and
 * it borrows what it can from that route's furniture: esc(), rehead(), page()
 * and canonical() out of functions/_shell.js. It imports them and changes
 * nothing there — _shell.js is byte-identical to what it was before splitwise,
 * and taking this feature out is deleting this file rather than unpicking that
 * one.
 *
 * Two things it does not borrow, for two different reasons. shell() names
 * lists.html, so the six lines below are that for this page. And head() spells
 * the title "<name> | Tallinn Tastebuds" — hardcoded there so that no caller
 * can spell it differently, which is right for a page of the site and wrong
 * for this one. A card in a message already carries the domain under it and
 * og:site_name beside it, so the suffix says the site's name a third time and
 * pushes the only words that matter — the ones the person naming the group
 * chose — further from the front. So the tags are written out below, and the
 * title is the group's name and nothing else.
 *
 * esc() is the one thing here that could not be a local copy. Group names are
 * typed by people and go straight into content="…" attributes, and the header
 * of _shell.js says why that escaping lives in exactly one place: two copies
 * is two places for one of them to fall behind.
 *
 * WHAT IT GIVES AWAY, AND WHY THAT IS NOTHING NEW
 *
 * The card carries the group's name and how many people are in it. That is
 * exactly what inviteOf() in functions/api/split.js already answers to anybody
 * holding the code, signed in or not — so the unfurl reveals nothing the link
 * did not already carry, and the whole point of the link is that it is handed
 * to people who are meant to have it.
 *
 * It never carries an expense, a balance or a member's name. Those need a
 * session and a membership, and a crawler has neither.
 *
 * NOINDEX, AND WHY THAT IS NOT A CONTRADICTION
 *
 * Being fetched and being indexed are two different things, and this wants the
 * first without the second. The card in a message is built by a fetch; the
 * page itself has nothing on it for a stranger and no business in a search
 * result, so page() sets noindex on every answer here.
 *
 * That is also why robots.txt no longer disallows /split. A Disallow stops the
 * fetch, and stopping the fetch is what makes a shared link arrive as a bare
 * blue URL — see the note beside /list/<id> in robots.txt, which has said so
 * for as long as lists have been shareable.
 *
 * WHEN IT CANNOT
 *
 * Every failure ends the same way: the untouched page, and assets/split.js
 * asks /api/split for the group the way it would have anyway. No database
 * bound, the wrong half of the split, a code that is not a group — all of them
 * are the plain shell. This route is an improvement on the load, never a
 * requirement for it.
 */

import { wrongDatabase } from './api/_lib.js';
import { inviteOf } from './api/split.js';
import { canonical, esc, rehead, page } from './_shell.js';

/* The card's picture, and it has to be absolute — an unfurler is not a browser
   and does not resolve a relative one. The live host even on a preview, which
   is what _shell.js does with the same file for the same reason: the image is
   the mark, it is identical on every deployment, and a preview URL in a card
   would be a link that outlives the deployment behind it. */
const CARD_IMAGE = 'https://tallinntastebuds.ee/assets/logo/og.jpg';

/* split.html out of the deployment. ASSETS is the binding Pages gives a
   Function for its own static files; the plain fetch is what makes this work
   under `wrangler pages dev`, where the binding is not always there. */
async function shell(context) {
  const url = new URL('/split.html', context.request.url);
  const res = context.env.ASSETS
    ? await context.env.ASSETS.fetch(new Request(url.toString()))
    : await fetch(url.toString());
  if (!res.ok) throw new Error('split.html unreadable: ' + res.status);
  return res.text();
}

/* The line under the name in a preview card.
 *
 * English, on a site read in ten languages, for the reason describe() in
 * functions/list/[id].js gives: this is the one string here with no reader to
 * ask. A crawler's Accept-Language is whatever its operator set, and the card
 * it builds is shown to everybody the link is forwarded to rather than to the
 * machine that fetched it. The page underneath follows the reader's own
 * language as usual.
 *
 * It says what to do rather than what this is, because somebody looking at
 * this card has been sent it by a friend and the only question they have is
 * whether to tap. */
function describe(invite) {
  if (invite.full) return 'This group is full.';
  const people = invite.people === 1 ? '1 person' : invite.people + ' people';
  return people + ' splitting what they paid for. Open the link to join.';
}

export async function onRequest(context) {
  const { request, env } = context;

  let html;
  try {
    html = await shell(context);
  } catch (e) {
    /* The page itself is missing from the deployment, which is a broken build
       rather than a missing group. Nothing here improves on Pages' answer. */
    return new Response('Not found', { status: 404 });
  }

  /* ?g= is the whole of this page's routing — see the header of
     assets/split.js. Without one this is the front door: somebody's own
     groups, or the offer of an account, and neither is a thing to unfurl. */
  const id = new URL(request.url).searchParams.get('g') || '';
  if (!id) return page(html, 200);

  if (!env.DB || (await wrongDatabase(env))) return page(html, 200);

  let invite;
  try {
    invite = await inviteOf(env, id);
  } catch (e) {
    /* The database being unreachable is not this page's failure to report:
       the script will ask /api/split in a moment and say what is true then. */
    return page(html, 200);
  }

  /* A code that is not a group. A 404 with the page on it rather than a bare
     status, so somebody following a link to a group that has been deleted
     lands somewhere that says so and offers the way on. */
  if (!invite) return page(html, 404);

  const name = esc(invite.name);
  const description = esc(describe(invite));
  const url = esc(canonical(request, '/split?g=' + encodeURIComponent(invite.id)));

  html = rehead(html, [
    /* The name on its own — see the header for why the site's is not appended
       to it. og:site_name below is what says where the link leads, which is
       what that half of the suffix was doing. */
    '<title>' + name + '</title>',
    '<meta name="description" content="' + description + '">',
    /* The header this page's response carries anyway, said in the markup too,
       so the page's own answer does not depend on nothing in front of it
       having stripped a header. */
    '<meta name="robots" content="noindex, nofollow">',
    /* Not "article" and not "profile": a group is a thing several people are
       looking at together, and "website" is the plainest true reading of that.
       Nothing unfurls it as anything richer, and claiming otherwise would only
       mislead whichever reader believed it. */
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Tallinn Tastebuds">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:title" content="' + name + '">',
    '<meta property="og:description" content="' + description + '">',
    '<meta property="og:image" content="' + CARD_IMAGE + '">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">'
  ].join('\n'));

  /* Never indexed, whatever it is. See the header. */
  return page(html, 200, false);
}
