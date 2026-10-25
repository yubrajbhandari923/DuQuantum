import { describe, expect, it } from 'vitest';
import handler from './[action]';

describe('Vercel tutor entry point', () => {
  it('answers the GitHub Pages preflight without contacting an AI provider', async () => {
    const request = new Request('https://du-quantum.vercel.app/api/tutor/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'https://yubrajbhandari923.github.io' },
    });
    const response = await handler.fetch(request);
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://yubrajbhandari923.github.io');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('rejects other origins and unsupported methods', async () => {
    const response = await handler.fetch(new Request('https://du-quantum.vercel.app/api/tutor/chat', {
      method: 'GET',
      headers: { Origin: 'https://example.com' },
    }));
    expect(response.status).toBe(405);
    expect(response.headers.has('access-control-allow-origin')).toBe(false);
  });
});
