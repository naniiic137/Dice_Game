// POST /update_name (Cloudflare Pages Function; the D1 database is bound as DB)
import { updateName } from '../lib/dice.js';

export const onRequestPost = ({ request, env }) => updateName(request, env.DB);
