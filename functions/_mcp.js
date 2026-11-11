/**
 * Tallinn Tastebuds — the Model Context Protocol, for the doors that speak it.
 *
 * POST        one JSON-RPC 2.0 message    ->  one JSON-RPC 2.0 answer
 *             a notification              ->  202, nothing
 * OPTIONS     a browser's preflight       ->  204, the CORS headers
 * GET, DELETE, anything else              ->  405, Allow: POST, OPTIONS
 *
 * The site has two doors an AI assistant reads it through: ./mcp.js, the map
 * and the public lists, and ./flashcard/mcp.js, the Estonian flashcards. What
 * each hands over is its own — its tools, what they answer with, what it is
 * told about itself — and is in its own file. What the two say the same way
 * is here: the transport, the handshake, the errors, and the handful of
 * helpers that read a tool's arguments and shape its result. It was all in
 * ./mcp.js while that was the only door, and came out when the second would
 * otherwise have been a copy of it.
 *
 * door() below is the whole of it: handed how a server introduces itself,
 * its instructions, its tools and the function that answers a call, it
 * returns the onRequest a Pages Function exports.
 *
 * WHY STATELESS
 *
 * The transport is the protocol's Streamable HTTP, which allows a server to
 * open a session on `initialize` — an `Mcp-Session-Id` the client sends back
 * on every request after — and to keep things between calls. A Pages
 * Function is an isolate that can be in any colo and remembers nothing from
 * one request to the next, so a session would be a row somewhere, and there
 * is nothing in this exchange worth a row: `initialize` says which tools
 * exist and a call answers out of a file or a table both sides can read
 * again tomorrow.
 * So no session is opened, no id is handed out, and every request is complete
 * on its own. A client that sends an id it got from somewhere else is
 * answered the same as one that sends none.
 *
 * WHY JSON ONLY
 *
 * The same transport lets a server answer with a stream of server-sent
 * events instead of one JSON body, for an answer that arrives in pieces, for
 * progress, for messages the server starts. A search over a few dozen rows
 * answers in one piece in a millisecond, and a stream to carry it would be a
 * connection held open for nothing on a plan that counts requests. So every
 * answer is one `application/json` body; a client asking to open the stream
 * with GET is told 405, which is how the protocol says a server declines it.
 * `Cache-Control: no-store` on all of it, because a JSON-RPC answer is to
 * one message and a cache has nothing to key it on.
 *
 * THE VERSIONS
 *
 * A client names the protocol version it speaks in `initialize`, and the
 * server answers with that one if it can speak it and with its newest if
 * not. VERSIONS below is what these speak, newest first: 2025-11-25 is
 * the current specification, and the two before it are what the clients
 * people actually run were built against. After `initialize` a client sends
 * the agreed version in an `MCP-Protocol-Version` header, and one naming a
 * version not in the list is answered 400, as the specification asks; one
 * with no header is assumed to be an older client and answered normally.
 * The batch of messages in one array that 2025-03-26 allowed was taken out
 * of the protocol in 2025-06-18, and these servers never took one: an array
 * is answered with one invalid-request error whatever version is in play.
 *
 * No resources, no prompts, no `tools/list` change notifications:
 * `capabilities` names tools and nothing else. No `Origin` check, and
 * `Access-Control-Allow-Origin: *` on every answer — WHAT IS NOT HERE, ON
 * PURPOSE in ./mcp.js is why, and it holds for both.
 */

import { json, foldWords } from './api/_lib.js';

/* Newest first: the one answered to a client that names none these servers
   speak. THE VERSIONS in the header. */
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];

/* JSON-RPC 2.0's own codes, and the only ones used. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

/* A query longer than this is a paragraph, and a paragraph's words match
   everything a little; the tools ask for a few words and hold to that. */
export const MAX_QUERY = 200;

/* Read-only, harmless to repeat, and over the site's own data rather than
   the open world; the same four on every tool of both doors. */
export const ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/* ---------------------------------------------------------- the arguments
 * A tool's arguments read off the call and held to the schema that was
 * sent, one message per thing wrong, so a model that passed a string for a
 * number is told which. Throws the message; door() turns it into the
 * protocol's invalid-params error.
 */
export function bad(message) {
  const e = new Error(message);
  e.invalid = true;
  return e;
}

export function optionalString(args, key, max) {
  const value = args[key];
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw bad(key + ' must be a string');
  return value.slice(0, max);
}

export function optionalNumber(args, key) {
  const value = args[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw bad(key + ' must be a number');
  return value;
}

/* Whether a call names one thing to read rather than asking for a search. */
export const named = (args) => args.id !== undefined && args.id !== null && args.id !== '';

/* A query as words: folded, split on anything that is not a letter or a
   digit, and the one-character pieces dropped, since "a" is in every name. */
export function wordsOf(query) {
  return foldWords(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
}

/* ------------------------------------------------------------ the results
 * The protocol's tool result: the object twice — as `structuredContent` for
 * a client that reads JSON and as the same JSON in a text block for one that
 * reads only text — or a sentence with isError on it, for an answer that is
 * "there is no such thing" rather than a fault in the asking.
 */
export function toolResult(object) {
  return { content: [{ type: 'text', text: JSON.stringify(object) }], structuredContent: object };
}

export function toolError(sentence) {
  return { content: [{ type: 'text', text: sentence }], isError: true };
}

/* ----------------------------------------------------------- the protocol
 * One message in, one answer out. The answer to a request carries its id;
 * a notification — no id — and a response the client sends are 202 with no
 * body, as the transport says.
 */
function reply(id, result) {
  return json({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message, status, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return json({ jsonrpc: '2.0', id: id === undefined ? null : id, error }, status);
}

function accepted() {
  return new Response(null, {
    status: 202,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

/* What a browser needs to be let read an answer, on every answer and on the
   preflight before one. The request headers are the ones the transport
   sends; nothing is credentialed. */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-max-age': '86400'
};

/* A door, as the onRequest its file exports. What it is handed:
 *
 *   server        how it introduces itself in `initialize`
 *   instructions  what the assistant is told before it has called anything
 *   tools         (context) -> the list tools/list hands over
 *   call          (context, name, args) -> a tool result, or undefined for a
 *                 name it does not answer; it may throw bad()
 *   names         the tools a call may ask for, for the error naming a wrong one
 *   what          what could not be read when a data file is missing from the
 *                 deployment: "The map", "The flashcards"
 */
export function door(spec) {
  async function answer(context, message) {
    const id = message.id;
    const params = message.params && typeof message.params === 'object' ? message.params : {};

    if (message.method === 'initialize') {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
      return reply(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: spec.server,
        instructions: spec.instructions
      });
    }

    if (message.method === 'ping') return reply(id, {});

    if (message.method === 'tools/list') return reply(id, { tools: await spec.tools(context) });

    if (message.method !== 'tools/call') {
      return fail(id, METHOD_NOT_FOUND, 'Method not found: ' + message.method);
    }

    const name = typeof params.name === 'string' ? params.name : '';
    const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
      ? params.arguments
      : {};
    let result;
    try {
      result = await spec.call(context, name, args);
    } catch (e) {
      if (e.invalid) return fail(id, INVALID_PARAMS, e.message);
      throw e;
    }
    return result === undefined
      ? fail(id, INVALID_PARAMS, 'Unknown tool: ' + name, 200, { tools: spec.names })
      : reply(id, result);
  }

  async function handle(context) {
    const request = context.request;

    if (request.method !== 'POST') {
      return new Response(null, {
        status: 405,
        headers: { allow: 'POST, OPTIONS', 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    const spoken = request.headers.get('MCP-Protocol-Version');
    if (spoken && !VERSIONS.includes(spoken)) {
      return fail(null, INVALID_REQUEST, 'Unsupported MCP-Protocol-Version: ' + spoken, 400, { supported: VERSIONS });
    }

    let message;
    try {
      message = JSON.parse(await request.text());
    } catch (e) {
      return fail(null, PARSE_ERROR, 'Parse error: the body is not JSON');
    }

    if (Array.isArray(message)) {
      return fail(null, INVALID_REQUEST, 'Batches are not supported: send one message per request');
    }
    if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
      return fail(null, INVALID_REQUEST, 'Invalid request: one JSON-RPC 2.0 message is expected');
    }

    /* A notification, or the client's answer to something: nothing to say
       back, and the transport wants a 202 with no body. A request whose id is
       the wrong shape is refused rather than mistaken for one. */
    if (!('id' in message)) {
      if (typeof message.method === 'string' || 'result' in message || 'error' in message) return accepted();
      return fail(null, INVALID_REQUEST, 'Invalid request: no method');
    }
    if (typeof message.id !== 'string' && typeof message.id !== 'number') {
      return fail(null, INVALID_REQUEST, 'Invalid request: id must be a string or a number');
    }
    if (typeof message.method !== 'string') {
      return fail(message.id, INVALID_REQUEST, 'Invalid request: no method');
    }

    try {
      return await answer(context, message);
    } catch (e) {
      /* A data file missing from the deployment is a broken build, not a bad
         question; say so in the protocol's own words rather than as a
         Worker's 500. */
      return fail(message.id, INTERNAL_ERROR, spec.what + ' could not be read: ' + (e && e.message ? e.message : e), 500);
    }
  }

  return async function onRequest(context) {
    const response = context.request.method === 'OPTIONS'
      ? new Response(null, { status: 204 })
      : await handle(context);
    for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
    return response;
  };
}
