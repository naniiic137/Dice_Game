"""Tests for the Dice Game Flask API. Run with: python -m unittest discover tests"""

import importlib
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


class DiceGameApiTests(unittest.TestCase):
    def setUp(self):
        # Each test gets its own throw-away SQLite file.
        self.tmpdir = tempfile.TemporaryDirectory()
        os.environ['DICE_DB_PATH'] = os.path.join(self.tmpdir.name, 'test.db')
        import app as app_module
        self.app_module = importlib.reload(app_module)
        self.client = self.app_module.app.test_client()

    def tearDown(self):
        os.environ.pop('DICE_DB_PATH', None)
        self.tmpdir.cleanup()

    def submit(self, name='Hamza', score=1234):
        return self.client.post('/submit_score', json={'name': name, 'score': score})

    # --- submitting scores -------------------------------------------------

    def test_submit_returns_id_and_edit_token(self):
        res = self.submit()
        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertEqual(body['status'], 'success')
        self.assertIsInstance(body['id'], int)
        self.assertGreaterEqual(len(body['edit_token']), 20)

    def test_edit_token_is_not_stored_in_plain_text_or_leaked(self):
        token = self.submit().get_json()['edit_token']
        conn = self.app_module.get_db_connection()
        stored = conn.execute('SELECT edit_token_hash FROM scores').fetchone()[0]
        conn.close()
        self.assertNotEqual(stored, token)
        self.assertNotIn(token, self.client.get('/leaderboard').get_data(as_text=True))
        self.assertNotIn('edit_token', self.client.get('/leaderboard').get_json()[0])

    def test_invalid_scores_are_rejected(self):
        for bad in [0, -5, 1.5, '100', None, True, 10**9]:
            with self.subTest(score=bad):
                self.assertEqual(self.submit(score=bad).status_code, 400)
        self.assertEqual(self.client.get('/leaderboard').get_json(), [])

    def test_invalid_names_are_rejected(self):
        for bad in ['', '   ', 'x' * 21, None, 123, '\n\t']:
            with self.subTest(name=bad):
                self.assertEqual(self.submit(name=bad).status_code, 400)

    def test_non_json_body_is_rejected(self):
        res = self.client.post('/submit_score', data='not json', content_type='text/plain')
        self.assertEqual(res.status_code, 400)

    # --- XSS ---------------------------------------------------------------

    def test_html_in_name_is_neutralised(self):
        payload = '<img src=x onerror=alert(1)>'[:20]
        self.assertEqual(self.submit(name=payload).status_code, 200)
        res = self.client.get('/leaderboard')
        self.assertEqual(res.mimetype, 'application/json')
        name = res.get_json()[0]['name']
        self.assertNotIn('<', name)
        self.assertNotIn('>', name)

    def test_control_characters_are_stripped(self):
        self.submit(name='Ha‮mza\x00\n  B')
        self.assertEqual(self.client.get('/leaderboard').get_json()[0]['name'], 'Hamza B')

    def test_frontend_renders_names_as_text_not_html(self):
        with open(os.path.join(ROOT, 'static', 'script.js'), encoding='utf-8') as f:
            script = f.read()
        self.assertNotIn('innerHTML', script)
        self.assertIn('nameCell.textContent = entry.name', script)

    # --- renaming ----------------------------------------------------------

    def test_rename_requires_the_right_token(self):
        body = self.submit().get_json()
        rename = {'id': body['id'], 'name': 'Hacked'}

        self.assertEqual(self.client.post('/update_name', json=rename).status_code, 400)
        wrong = dict(rename, edit_token='not-the-token')
        self.assertEqual(self.client.post('/update_name', json=wrong).status_code, 403)
        self.assertEqual(self.client.get('/leaderboard').get_json()[0]['name'], 'Hamza')

        ok = dict(rename, name='Hamza B', edit_token=body['edit_token'])
        self.assertEqual(self.client.post('/update_name', json=ok).status_code, 200)
        self.assertEqual(self.client.get('/leaderboard').get_json()[0]['name'], 'Hamza B')

    def test_token_only_works_for_its_own_score(self):
        first = self.submit(name='Alice', score=10).get_json()
        second = self.submit(name='Bob', score=20).get_json()
        steal = {'id': second['id'], 'name': 'Alice2', 'edit_token': first['edit_token']}
        self.assertEqual(self.client.post('/update_name', json=steal).status_code, 403)

    def test_rename_validates_the_new_name(self):
        body = self.submit().get_json()
        bad = {'id': body['id'], 'name': 'y' * 50, 'edit_token': body['edit_token']}
        self.assertEqual(self.client.post('/update_name', json=bad).status_code, 400)

    def test_legacy_rows_without_token_cannot_be_renamed(self):
        conn = self.app_module.get_db_connection()
        conn.execute("INSERT INTO scores (name, score) VALUES ('Old', 50)")
        conn.commit()
        conn.close()
        res = self.client.post('/update_name', json={'id': 1, 'name': 'New', 'edit_token': ''})
        self.assertEqual(res.status_code, 403)

    # --- pages / migration -------------------------------------------------

    def test_index_page_renders(self):
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'leaderboard-list', res.data)

    def test_old_database_is_migrated(self):
        # Simulate a database created by the previous version (no token column).
        import sqlite3
        path = os.environ['DICE_DB_PATH']
        os.remove(path)
        conn = sqlite3.connect(path)
        conn.execute('CREATE TABLE scores (id INTEGER PRIMARY KEY AUTOINCREMENT, '
                     'name TEXT NOT NULL, score INTEGER NOT NULL)')
        conn.execute("INSERT INTO scores (name, score) VALUES ('Old', 42)")
        conn.commit()
        conn.close()
        self.app_module.init_db()
        self.assertEqual(self.submit(name='New', score=7).status_code, 200)
        names = [e['name'] for e in self.client.get('/leaderboard').get_json()]
        self.assertEqual(names, ['New', 'Old'])

    # --- leaderboard -------------------------------------------------------

    def test_leaderboard_is_sorted_and_limited(self):
        for i, score in enumerate([50, 5, 500, 1, 7, 9, 3, 2, 8, 4, 6, 100]):
            self.submit(name=f'P{i}', score=score)
        scores = [e['score'] for e in self.client.get('/leaderboard').get_json()]
        self.assertEqual(scores, [1, 2, 3, 4, 5, 6, 7, 8, 9, 50])


if __name__ == '__main__':
    unittest.main()
