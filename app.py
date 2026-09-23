"""Dice Game - Flask backend (leaderboard API + page)."""

import hashlib
import hmac
import os
import secrets
import sqlite3
import unicodedata

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get('DICE_DB_PATH', os.path.join(BASE_DIR, 'database.db'))

NAME_MAX_LENGTH = 20
# Six dice all showing the same face has probability 1/7776 per roll, so a
# typical game takes a few thousand rolls. Anything above this is not a real game.
SCORE_MAX = 1_000_000


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL
        )
    ''')
    # Migration for databases created before edit tokens existed.
    columns = {row['name'] for row in conn.execute('PRAGMA table_info(scores)')}
    if 'edit_token_hash' not in columns:
        conn.execute('ALTER TABLE scores ADD COLUMN edit_token_hash TEXT')
    conn.commit()
    conn.close()


def clean_name(value):
    """Return a safe display name, or None if the value is not acceptable."""
    if not isinstance(value, str):
        return None
    # Drop control/format characters (newlines, zero-width chars, RTL overrides...)
    # and angle brackets, collapse whitespace, then enforce the length limit.
    value = ''.join(
        ch for ch in value
        if unicodedata.category(ch)[0] != 'C' and ch not in '<>'
    )
    value = ' '.join(value.split())
    if not value or len(value) > NAME_MAX_LENGTH:
        return None
    return value


def clean_score(value):
    """Return the score as an int, or None if it is not a plausible score."""
    # bool is a subclass of int in Python, so reject it explicitly.
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if value < 1 or value > SCORE_MAX:
        return None
    return value


def hash_token(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def error(message, status=400):
    return jsonify({'status': 'error', 'message': message}), status


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/submit_score', methods=['POST'])
def submit_score():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error('Expected a JSON object.')

    name = clean_name(data.get('name'))
    if name is None:
        return error(f'Name must be 1-{NAME_MAX_LENGTH} visible characters.')
    score = clean_score(data.get('score'))
    if score is None:
        return error(f'Score must be a whole number between 1 and {SCORE_MAX}.')

    # The raw token goes back to the browser once; only its hash is stored.
    edit_token = secrets.token_urlsafe(24)
    conn = get_db_connection()
    cursor = conn.execute(
        'INSERT INTO scores (name, score, edit_token_hash) VALUES (?, ?, ?)',
        (name, score, hash_token(edit_token)),
    )
    conn.commit()
    score_id = cursor.lastrowid
    conn.close()
    return jsonify({'status': 'success', 'id': score_id, 'edit_token': edit_token})


@app.route('/leaderboard')
def leaderboard():
    conn = get_db_connection()
    # Lower score (fewer rolls) is better.
    scores = conn.execute(
        'SELECT id, name, score FROM scores ORDER BY score ASC, id ASC LIMIT 10'
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in scores])


@app.route('/update_name', methods=['POST'])
def update_name():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error('Expected a JSON object.')

    score_id = data.get('id')
    token = data.get('edit_token')
    if isinstance(score_id, str) and score_id.isdigit():
        score_id = int(score_id)
    if isinstance(score_id, bool) or not isinstance(score_id, int) or not isinstance(token, str):
        return error('Missing score id or edit token.')
    name = clean_name(data.get('name'))
    if name is None:
        return error(f'Name must be 1-{NAME_MAX_LENGTH} visible characters.')

    conn = get_db_connection()
    row = conn.execute('SELECT edit_token_hash FROM scores WHERE id = ?', (score_id,)).fetchone()
    if row is None or not row['edit_token_hash'] or not hmac.compare_digest(
        row['edit_token_hash'], hash_token(token)
    ):
        conn.close()
        return error('You can only rename scores submitted from this browser.', 403)

    conn.execute('UPDATE scores SET name = ? WHERE id = ?', (name, score_id))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success', 'name': name})


# Initialize the database when the module is imported (needed on PythonAnywhere,
# where the WSGI server imports app.py instead of running it).
init_db()

if __name__ == '__main__':
    # Debug mode is off unless explicitly enabled: FLASK_DEBUG=1 python app.py
    app.run(debug=os.environ.get('FLASK_DEBUG') == '1')
