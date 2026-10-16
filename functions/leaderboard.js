// GET /leaderboard (Cloudflare Pages Function; the D1 database is bound as DB)
import { leaderboard } from '../lib/dice.js';

export const onRequestGet = ({ env }) => leaderboard(env.DB);
