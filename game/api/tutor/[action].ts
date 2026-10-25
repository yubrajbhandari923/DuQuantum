// Vercel function for /api/tutor/chat, /tts and /stt; set GEMINI_API_KEY and ELEVENLABS_API_KEY in the project's environment.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tutorMiddleware } from '../../server/handlers';

const handle = tutorMiddleware(process.env);
export default (req: IncomingMessage, res: ServerResponse) => handle(req, res, () => { res.statusCode = 404; res.end(); });
