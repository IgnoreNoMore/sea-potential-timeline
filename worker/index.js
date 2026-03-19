/**
 * sea-potential-api — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /tasks        → full task array as JSON
 *   POST /tasks        → replace full task array
 *   GET  /completions  → completion log object as JSON
 *   POST /completions  → replace completion log
 *   GET  /settings     → settings object as JSON
 *   POST /settings     → replace settings object
 *
 * All POST requests require the header:
 *   X-Api-Key: <value of the API_KEY Cloudflare secret>
 *
 * KV namespace binding: SP_STORE
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
};

const DEFAULTS = {
  tasks: [],
  completions: {},
  settings: null,
};

const VALID_KEYS = ['tasks', 'completions', 'settings'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function handleRequest(request, env) {
  const { method } = request;
  const url = new URL(request.url);
  // strip leading slash and trailing slash; e.g. "/tasks" → "tasks"
  const key = url.pathname.replace(/^\/|\/$/g, '');

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // ── Route validation ────────────────────────────────────────────────────────
  if (!VALID_KEYS.includes(key)) {
    return json({ error: 'Not found' }, 404);
  }

  // ── GET: read from KV ───────────────────────────────────────────────────────
  if (method === 'GET') {
    const raw = await env.SP_STORE.get(key);
    return json(raw ? JSON.parse(raw) : DEFAULTS[key]);
  }

  // ── POST: authenticate then write to KV ─────────────────────────────────────
  if (method === 'POST') {
    const provided = request.headers.get('X-Api-Key') ?? '';
    if (!provided || provided !== env.API_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    await env.SP_STORE.put(key, JSON.stringify(body));
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}

export default {
  fetch: (request, env, ctx) => handleRequest(request, env),
};
