"""Turn the PythonAnywhere leaderboard (database.db) into import.sql for Cloudflare D1.

Usage: python scripts/export_scores.py path/to/database.db
Then paste import.sql into the D1 database's Console (after schema.sql) and run it.
Keeps every row with its id, name, score and edit-token hash.
"""
import sqlite3
import sys


def quote(value):
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main(path):
    conn = sqlite3.connect(path)
    columns = {row[1] for row in conn.execute('PRAGMA table_info(scores)')}
    token = 'edit_token_hash' if 'edit_token_hash' in columns else 'NULL'
    rows = conn.execute(f'SELECT id, name, score, {token} FROM scores ORDER BY id').fetchall()
    conn.close()
    lines = [
        f'INSERT INTO scores (id, name, score, edit_token_hash) VALUES ({", ".join(quote(v) for v in row)});'
        for row in rows
    ]
    with open('import.sql', 'w', encoding='utf-8') as out:
        out.write('\n'.join(lines) + '\n')
    print(f'import.sql: {len(rows)} scores')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python scripts/export_scores.py path/to/database.db')
    main(sys.argv[1])
