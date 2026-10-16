-- The leaderboard table for Cloudflare D1 (same columns as app.py's SQLite database).
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    edit_token_hash TEXT
);
