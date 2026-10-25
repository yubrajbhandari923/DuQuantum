// Vite plugin that serves the tutor endpoints on the dev and preview servers, with keys from game/.env.local.
import { loadEnv, type Plugin } from 'vite';
import { tutorMiddleware } from './handlers';

type Env = Record<string, string | undefined>;
export function tutor(): Plugin {
  let env: Env = {};
  return {
    name: 'schrodinger-tutor',
    configResolved(c) { env = { ...loadEnv(c.mode, c.root, ''), ...process.env }; },
    configureServer(s) { s.middlewares.use(tutorMiddleware(env)); },
    configurePreviewServer(s) { s.middlewares.use(tutorMiddleware(env)); },
  };
}
