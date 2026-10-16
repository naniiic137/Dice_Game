// Builds public/ for Cloudflare Pages: the game page (templates/index.html without Flask's
// url_for) and the static files. Pages runs it with: node scripts/build-pages.mjs
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('public', { recursive: true, force: true });
mkdirSync('public');
cpSync('static', 'public/static', { recursive: true });
const page = readFileSync('templates/index.html', 'utf8').replace(
  /\{\{\s*url_for\('static',\s*filename='([^']+)'\)\s*\}\}/g, '/static/$1');
if (/\{\{|\{%/.test(page)) throw new Error('templates/index.html has Flask template code this build does not handle');
writeFileSync('public/index.html', page);
console.log('public/ ready');
