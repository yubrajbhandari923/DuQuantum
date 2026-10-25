// Vercel function for /api/tutor/chat, /tts and /stt. API keys stay in Vercel's environment.
import { chat, stt, tts, VOICES } from '../../server/handlers.js';

const PAGES_ORIGIN = 'https://yubrajbhandari923.github.io';

function cors(request: Request): Record<string, string> {
  return request.headers.get('origin') === PAGES_ORIGIN
    ? {
        'Access-Control-Allow-Origin': PAGES_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : {};
}

export default {
  async fetch(request: Request): Promise<Response> {
    const headers = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers });

    try {
      const action = new URL(request.url).pathname.split('/').pop();
      if (action === 'chat') {
        if (!process.env.GEMINI_API_KEY) return Response.json({ error: 'The tutor is offline (no GEMINI_API_KEY).' }, { status: 503, headers });
        return Response.json(await chat(process.env, await request.json()), { headers });
      }
      if (action === 'tts' || action === 'stt') {
        if (!process.env.ELEVENLABS_API_KEY) return Response.json({ error: 'Voices are offline (no ELEVENLABS_API_KEY).' }, { status: 503, headers });
        if (action === 'tts') {
          const { text, who } = await request.json();
          const mp3 = await tts(process.env, text, who as keyof typeof VOICES);
          return new Response(new Uint8Array(mp3), { headers: { ...headers, 'Content-Type': 'audio/mpeg' } });
        }
        const audio = Buffer.from(await request.arrayBuffer());
        if (audio.length > 5_000_000) return Response.json({ error: 'Audio is too large.' }, { status: 413, headers });
        return Response.json(await stt(process.env, audio, request.headers.get('content-type') || 'audio/webm'), { headers });
      }
      return Response.json({ error: 'unknown endpoint' }, { status: 404, headers });
    } catch (error) {
      console.error('[tutor]', (error as Error).message);
      return Response.json({ error: 'The tutor could not answer just now.' }, { status: 502, headers });
    }
  },
};
