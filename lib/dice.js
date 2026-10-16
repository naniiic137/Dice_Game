// Dice Game - leaderboard logic for Cloudflare Pages Functions + D1.
// Same rules and same JSON answers as app.py (the Flask version), so static/script.js works unchanged.

export const NAME_MAX_LENGTH = 20;
// Six dice all showing the same face has probability 1/7776 per roll, so a
// typical game takes a few thousand rolls. Anything above this is not a real game.
export const SCORE_MAX = 1_000_000;

/** Return a safe display name, or null if the value is not acceptable. */
export function cleanName(value) {
  if (typeof value !== 'string') return null;
  // Drop control/format characters (newlines, zero-width chars, RTL overrides...)
  // and angle brackets, collapse whitespace, then enforce the length limit.
  let out = '';
  for (const ch of value) if (!/\p{C}/u.test(ch) && ch !== '<' && ch !== '>') out += ch;
  out = out.split(/\s+/u).filter(Boolean).join(' ');
  if (!out || [...out].length > NAME_MAX_LENGTH) return null;
  return out;
}

/** Return the score as an integer, or null if it is not a plausible score. */
export function cleanScore(value) {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > SCORE_MAX) return null;
  return value;
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 24 random bytes as URL-safe base64, like Python's secrets.token_urlsafe(24). */
export function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compare two strings in constant time (like hmac.compare_digest). */
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const error = (message, status = 400) => json({ status: 'error', message }, status);
async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export async function submitScore(request, db) {
  const data = await readJson(request);
  if (!isObject(data)) return error('Expected a JSON object.');
  const name = cleanName(data.name);
  if (name === null) return error(`Name must be 1-${NAME_MAX_LENGTH} visible characters.`);
  const score = cleanScore(data.score);
  if (score === null) return error(`Score must be a whole number between 1 and ${SCORE_MAX}.`);

  // The raw token goes back to the browser once; only its hash is stored.
  const editToken = newToken();
  const res = await db.prepare('INSERT INTO scores (name, score, edit_token_hash) VALUES (?, ?, ?)')
    .bind(name, score, await hashToken(editToken)).run();
  return json({ status: 'success', id: res.meta.last_row_id, edit_token: editToken });
}

export async function leaderboard(db) {
  // Lower score (fewer rolls) is better.
  const { results } = await db.prepare('SELECT id, name, score FROM scores ORDER BY score ASC, id ASC LIMIT 10').all();
  return json(results);
}

export async function updateName(request, db) {
  const data = await readJson(request);
  if (!isObject(data)) return error('Expected a JSON object.');
  let scoreId = data.id;
  const token = data.edit_token;
  if (typeof scoreId === 'string' && /^\d+$/.test(scoreId)) scoreId = Number(scoreId);
  if (typeof scoreId !== 'number' || !Number.isInteger(scoreId) || typeof token !== 'string') return error('Missing score id or edit token.');
  const name = cleanName(data.name);
  if (name === null) return error(`Name must be 1-${NAME_MAX_LENGTH} visible characters.`);

  const row = await db.prepare('SELECT edit_token_hash FROM scores WHERE id = ?').bind(scoreId).first();
  if (!row || !row.edit_token_hash || !sameString(row.edit_token_hash, await hashToken(token))) {
    return error('You can only rename scores submitted from this browser.', 403);
  }
  await db.prepare('UPDATE scores SET name = ? WHERE id = ?').bind(name, scoreId).run();
  return json({ status: 'success', name });
}
