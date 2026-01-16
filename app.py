from flask import Flask, render_template, request, jsonify
import sqlite3
import os

app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'database.db')

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
    conn.commit()
    conn.close()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/submit_score', methods=['POST'])
def submit_score():
    data = request.get_json()
    name = data.get('name')
    score = data.get('score')
    
    if name and score is not None:
        conn = get_db_connection()
        conn.execute('INSERT INTO scores (name, score) VALUES (?, ?)', (name, score))
        conn.commit()
        conn.close()
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error'}), 400

@app.route('/leaderboard')
def leaderboard():
    conn = get_db_connection()
    # Order by score ASC because lower score (fewer rolls) is better
    scores = conn.execute('SELECT name, score FROM scores ORDER BY score ASC LIMIT 10').fetchall()
    conn.close()
    return jsonify([dict(row) for row in scores])

# Initialize the database when the app starts (Crucial for PythonAnywhere)
init_db()

if __name__ == '__main__':
    app.run(debug=True)