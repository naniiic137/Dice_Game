// Tests for the Cloudflare Pages version (lib/dice.js), the same cases as test_app.py.
// D1 is stood in for by Node's built-in SQLite. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { submitScore, leaderboard, updateName, hashToken, SCORE_MAX } from '../lib/dice.js';

// a tiny D1 look-alike: prepare().bind().run() / .all() / .first()
function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const prepare = (q) => {
    let args = [];
    const st = {
      bind: (...a) => { args = a; return st; },
      run: async () => { const r = sql.prepare(q).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
      all: async () => ({ results: sql.prepare(q).all(...args).map((r) => ({ ...r })) }),
      first: async () => { const r = sql.prepare(q).get(...args); return r ? { ...r } : null; },
    };
    return st;
  };
  return { prepare, sql };
}
const post = (body) => new Request('https://dice.test/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const call = async (res) => ({ status: res.status, body: await res.json() });

test('submit returns an id and an edit token', async () => {
  const db = fakeD1();
  const r = await call(await submitScore(post({ name: 'Alice', score: 1200 }), db));
  assert.equal(r.status, 200); assert.equal(r.body.status, 'success'); assert.equal(r.body.id, 1);
  assert.match(r.body.edit_token, /^[A-Za-z0-9_-]{32}$/);
});

test('the edit token is stored hashed, never in plain text, and the leaderboard never shows it', async () => {
  const db = fakeD1();
  const r = await call(await submitScore(post({ name: 'Alice', score: 1200 }), db));
  const row = db.sql.prepare('SELECT edit_token_hash FROM scores').get();
  assert.notEqual(row.edit_token_hash, r.body.edit_token);
  assert.equal(row.edit_token_hash, await hashToken(r.body.edit_token));
  const lb = await call(await leaderboard(db));
  assert.deepEqual(Object.keys(lb.body[0]).sort(), ['id', 'name', 'score']);
});

test('invalid scores are rejected', async () => {
  const db = fakeD1();
  for (const score of [0, -5, SCORE_MAX + 1, 12.5, '100', true, null]) {
    const r = await call(await submitScore(post({ name: 'Bob', score }), db));
    assert.equal(r.status, 400, `score ${JSON.stringify(score)}`); assert.equal(r.body.status, 'error');
  }
});

test('invalid names are rejected', async () => {
  const db = fakeD1();
  for (const name of ['', '   ', 'x'.repeat(21), 42, null, '​​']) {
    const r = await call(await submitScore(post({ name, score: 10 }), db));
    assert.equal(r.status, 400, `name ${JSON.stringify(name)}`);
  }
});

test('a body that is not a JSON object is rejected', async () => {
  const db = fakeD1();
  for (const body of ['not json', '[1,2]', '"text"']) assert.equal((await submitScore(post(body), db)).status, 400);
  assert.equal((await updateName(post('not json'), db)).status, 400);
});

test('HTML in a name is neutralised and control characters are stripped', async () => {
  const db = fakeD1();
  await submitScore(post({ name: '<b>Bob</b>', score: 5 }), db);
  await submitScore(post({ name: 'Bo\nb‮  Smith\u0000', score: 6 }), db);
  const lb = (await call(await leaderboard(db))).body;
  assert.equal(lb[0].name, 'bBob/b');
  assert.equal(lb[1].name, 'Bob Smith');
});

test('renaming needs the right token, and a token only works for its own score', async () => {
  const db = fakeD1();
  const a = (await call(await submitScore(post({ name: 'Alice', score: 100 }), db))).body;
  const b = (await call(await submitScore(post({ name: 'Bob', score: 200 }), db))).body;
  assert.equal((await updateName(post({ id: a.id, edit_token: 'wrong', name: 'Hacker' }), db)).status, 403);
  assert.equal((await updateName(post({ id: b.id, edit_token: a.edit_token, name: 'Hacker' }), db)).status, 403);
  const ok = await call(await updateName(post({ id: String(a.id), edit_token: a.edit_token, name: 'Alicia' }), db));
  assert.equal(ok.status, 200); assert.equal(ok.body.name, 'Alicia');
  assert.deepEqual((await call(await leaderboard(db))).body.map((r) => r.name), ['Alicia', 'Bob']);
});

test('a rename validates the new name and needs an id and a token', async () => {
  const db = fakeD1();
  const a = (await call(await submitScore(post({ name: 'Alice', score: 100 }), db))).body;
  assert.equal((await updateName(post({ id: a.id, edit_token: a.edit_token, name: '' }), db)).status, 400);
  assert.equal((await updateName(post({ edit_token: a.edit_token, name: 'X' }), db)).status, 400);
  assert.equal((await updateName(post({ id: true, edit_token: a.edit_token, name: 'X' }), db)).status, 400);
});

test('old rows without a token (from before edit tokens) cannot be renamed', async () => {
  const db = fakeD1();
  db.sql.prepare("INSERT INTO scores (name, score) VALUES ('Old', 50)").run();
  assert.equal((await updateName(post({ id: 1, edit_token: '', name: 'New' }), db)).status, 403);
  assert.equal((await updateName(post({ id: 1, edit_token: 'anything', name: 'New' }), db)).status, 403);
});

test('the leaderboard is sorted (fewest rolls first, then oldest) and shows 10', async () => {
  const db = fakeD1();
  for (const [n, s] of [['a', 50], ['b', 20], ['c', 20], ...Array.from({ length: 10 }, (_, i) => ['z' + i, 900 + i])]) await submitScore(post({ name: n, score: s }), db);
  const lb = (await call(await leaderboard(db))).body;
  assert.equal(lb.length, 10);
  assert.deepEqual(lb.slice(0, 3).map((r) => r.name), ['b', 'c', 'a']);
});

test('the Pages build makes a plain page that loads the same static files', () => {
  assert.ok(existsSync(new URL('../public/index.html', import.meta.url)), 'run node scripts/build-pages.mjs first');
  const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('/static/style.css') && page.includes('/static/script.js'));
  assert.ok(!page.includes('{{') && !page.includes('{%'));
});
