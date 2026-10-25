// Vercel function for /api/tutor/chat, /tts and /stt; set GEMINI_API_KEY and ELEVENLABS_API_KEY in the project's environment.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tutorMiddleware } from '../../server/handlers';

const handle = tutorMiddleware(process.env);
export default (req: IncomingMessage, res: ServerResponse) => {
  if (req.headers.origin === 'https://yubrajbhandari923.github.io') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  return handle(req, res, () => { res.statusCode = 404; res.end(); });
};
