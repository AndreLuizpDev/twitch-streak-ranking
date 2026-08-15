addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const params = url.searchParams;
  let channel = params.get('channel');
  const limit = params.get('limit') || '50';

  // support path style: /proxy/streaks/:channel
  if (!channel) {
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('streaks');
    if (idx !== -1 && parts.length > idx + 1) {
      channel = parts[idx + 1];
    }
  }

  if (!channel) {
    return new Response(JSON.stringify({ error: 'missing channel' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiUrl = `https://lumosbot.app/api/twitch/streaks/${encodeURIComponent(
    channel
  )}?limit=${encodeURIComponent(limit)}`;

  const resp = await fetch(apiUrl);
  const body = await resp.arrayBuffer();

  const headers = new Headers(resp.headers);
  // ensure CORS headers are present for browser usage
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  return new Response(body, { status: resp.status, headers });
}

/*
Usage (example):
- Deploy this worker to Cloudflare (Workers) and use the worker URL in
  `script.js` via `DEPLOYED_PROXY = 'https://your-worker.workers.dev'`.
- The client will call: `${DEPLOYED_PROXY}?channel=mrfalll&limit=50`
*/
