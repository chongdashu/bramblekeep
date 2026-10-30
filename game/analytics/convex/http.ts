import { anyApi, httpActionGeneric, httpRouter } from 'convex/server';
import { parseEvent } from '../contract';

const http = httpRouter();
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
http.route({ path: '/events/client', method: 'OPTIONS', handler: httpActionGeneric(async () => new Response(null, { status: 204, headers: cors })) });

function equalSecret(a: string, b: string) {
  let different = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return different === 0;
}
async function readBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > 16_384) { await reader.cancel(); return null; }
    text += decoder.decode(value, { stream: true });
  }
}
const ingest = (source: 'client' | 'server') => httpActionGeneric(async (ctx, request) => {
  if (source === 'server') {
    const expected = process.env.BRAMBLEKEEP_INGEST_KEY;
    const actual = request.headers.get('authorization') ?? '';
    if (!expected || !equalSecret(actual, `Bearer ${expected}`)) return new Response('Unauthorized', { status: 401 });
  }
  if (Number(request.headers.get('content-length') ?? 0) > 16_384) return new Response('Too large', { status: 413, headers: cors });
  let body: unknown;
  try { const raw = await readBody(request); if (raw === null) return new Response('Too large', { status: 413, headers: cors }); body = JSON.parse(raw); }
  catch { return new Response('Invalid JSON', { status: 400, headers: cors }); }
  if (!Array.isArray(body) || !body.length || body.length > 20) return new Response('Invalid batch', { status: 400, headers: cors });
  const now = Date.now(), events = body.map(value => parseEvent(value, source, now));
  if (events.some(value => value === null)) return new Response('Invalid event', { status: 400, headers: cors });
  // Fail closed at the deployment too: an outdated or misconfigured client
  // must not write playtest, web, or unidentified events to production.
  if (process.env.BRAMBLEKEEP_ANALYTICS_ENV === 'production' && events.some(event => event?.traffic !== 'live' || event.channel !== 'wavedash')) {
    return new Response('Production accepts live Wavedash traffic only', { status: 403, headers: cors });
  }
  try { await ctx.runMutation(anyApi.analytics.ingest, { events, source }); }
  catch { return new Response('Rate limit or ingest failure', { status: 429, headers: cors }); }
  return new Response(null, { status: 204, headers: cors });
});
http.route({ path: '/events/client', method: 'POST', handler: ingest('client') });
http.route({ path: '/events/server', method: 'POST', handler: ingest('server') });
export default http;
