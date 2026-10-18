# 🎲 Dice Game

A small web game built with Flask and vanilla JavaScript. Six dice roll automatically; the round ends when all six show the same face, and the number of rolls it took is your score. Fewer rolls is better, and a global leaderboard keeps the top 10.

(The chance of six matching dice on one roll is 6 / 6⁶ = 1 in 7,776, so a typical game takes a few thousand rolls.)

## 🌐 Live Demo

👉 **[https://dice-of-chance.pages.dev](https://dice-of-chance.pages.dev)** (Cloudflare Pages + D1, free, nothing to renew)

## ✨ Features

- **Automatic dice rolling** with image-based dice and **Faster / Slower** speed controls.
- **Global leaderboard** (SQLite) showing the 10 lowest roll counts.
- **Rename your own score**: when you submit a score the server returns a one-time edit token; the browser keeps it in `localStorage` and only a SHA-256 hash is stored in the database. Only the browser that submitted a score can rename it.
- **Refresh-proof rounds**: the roll counter and a finished round are kept in `localStorage`, so refreshing the page does not reset your count.
- **Server-side validation**: names are 1–20 visible characters (control characters and `<` `>` are stripped), scores must be whole numbers between 1 and 1,000,000.
- **XSS-safe rendering**: leaderboard names are always inserted with `textContent`, never as HTML.
- Layout adapts to phone screens.

**Tech stack:** Python 3, Flask, SQLite, HTML, CSS, JavaScript.

## 🛠️ Run locally

```bash
git clone https://github.com/naniiic137/Dice_Game.git
cd Dice_Game
python -m venv venv
# Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open `http://127.0.0.1:5000`. The SQLite file `database.db` is created next to `app.py` on first start (set `DICE_DB_PATH` to use another location).

Debug mode is **off** by default. For local development only: `FLASK_DEBUG=1 python app.py` (PowerShell: `$env:FLASK_DEBUG=1; python app.py`).

## ✅ Tests

The tests use Flask's built-in test client and a temporary database; no server is started.

```bash
python -m unittest discover tests -v
```

They cover score and name validation, HTML/control-character stripping, edit-token checks on renaming, leaderboard ordering, and migrating a database created by the older version.

The Cloudflare version (below) has the same checks in `tests/test_pages.mjs`, run against Node's built-in SQLite (Node 22.5+, nothing to install):

```bash
node scripts/build-pages.mjs
node --test tests/test_pages.mjs
```

## ☁️ Cloudflare Pages version (the live demo)

The live demo runs on **Cloudflare Pages** with a **D1** database (Cloudflare's SQLite). The free plan has no expiry and nothing to renew; free usage resets daily (100,000 requests to the score API, 5 million rows read, 100,000 rows written per day), far more than this game needs.

- `functions/` holds the three routes (`/leaderboard`, `/submit_score`, `/update_name`), which use `lib/dice.js`: the same rules and JSON answers as `app.py`, so `static/script.js` is unchanged.
- `scripts/build-pages.mjs` builds `public/` (the page without Flask's `url_for`, plus `static/`).
- `schema.sql` creates the table; `scripts/export_scores.py database.db` turns an existing leaderboard into `import.sql`.

**Setting it up** (Cloudflare dashboard):
1. **Storage & databases → D1 → Create database** (e.g. `dice-game`). In its **Console**, run `schema.sql`, then `import.sql` if you are bringing scores over.
2. **Workers & Pages → Create application → Pages → Connect to Git** → this repo, branch `main`, framework preset **None**, build command `node scripts/build-pages.mjs`, build output directory `public`.
3. The project's **Settings → Bindings → Add → D1 database**: variable name `DB`, database `dice-game`. Then **Deployments → Retry deployment** so the binding takes effect.

Every push to `main` redeploys it.

## 🚀 Deploying the Flask version to PythonAnywhere (old host)

The demo used to run on PythonAnywhere; its free web apps now expire every month, so it moved to Cloudflare. To run the Flask version there anyway:

1. Open a **Bash console** on PythonAnywhere and pull the latest code:
   ```bash
   cd ~/Dice_Game        # or wherever the repo was cloned
   git pull
   ```
2. Go to the **Web** tab and click **Reload** for `nanic137.pythonanywhere.com`.

The existing `database.db` is kept. When the app reloads, it adds the new `edit_token_hash` column automatically. Scores saved before this update keep their names but can no longer be renamed, because they have no edit token.

## 📂 Project Structure

```
app.py              Flask app: page route + JSON API (/submit_score, /leaderboard, /update_name)
templates/index.html  Game page
static/script.js    Dice rolling, leaderboard rendering, submit / rename logic
static/style.css    Styles
static/images/      Dice faces d1.png … d6.png
tests/test_app.py   API tests (unittest + Flask test client)
```

## ⚠️ Limitations

- The game runs in the browser, so the score is computed client-side. The server rejects impossible values but cannot prove a score was actually played. Treat the leaderboard as a friendly board, not a competitive one.
- There is no rate limiting or moderation on submissions.
- Rename rights live in the browser's `localStorage`: clearing site data or switching device loses them.

## License

© 2026 Hamza Ben Ismail. All rights reserved.
