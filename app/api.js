// make.fun public API, read-only GET. One request per view, answers cached and
// revalidated with ETags: the API binds an ETag to the minute, so a repeat fetch
// inside the minute answers 304 and costs no fresh body. Fresh answers are also
// reused for 45 s without any request at all.
// Rebuilt in sealed recording (attempt 3).
const API = 'https://make.fun/api';
const FRESH_MS = 45_000;
const cache = new Map(); // path -> { etag, body, at }

async function get(path) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.body;
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && hit) {
    hit.at = Date.now();
    return hit.body;
  }
  if (!res.ok) throw new Error(`make.fun API ${res.status} for ${path}`);
  const body = await res.json();
  cache.set(path, { etag: res.headers.get('etag'), body, at: Date.now() });
  return body;
}

/** The board: open bounties, times only (no per-bounty activity payload). */
export const getBounties = () => get('/competitions?status=open&activity=times&limit=100');

/** One bounty, by slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: one request, the whole ranked list (the API answers
 *  the full list; the page shows 50 rows at first and reveals more on click). */
export const getLeaderboard = (slug) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
