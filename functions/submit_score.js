// POST /submit_score (Cloudflare Pages Function; the D1 database is bound as DB)
import { submitScore } from '../lib/dice.js';

export const onRequestPost = ({ request, env }) => submitScore(request, env.DB);
