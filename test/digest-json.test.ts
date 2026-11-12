import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';

const app = createApp({ adapter: 'x', installed: 'x', beatEverySeconds: 1, runsDir: 'runs' });

describe('GET /api/digest/:night', () => {
  it('returns readNight output for 2026-10-28', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(readNight('runs', '2026-10-28'));
  });

  it('404s for a missing night and a malformed one', async () => {
    for (const n of ['2026-01-01', 'nope']) {
      const res = await app.request(`/api/digest/${n}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not found' });
    }
  });
});
