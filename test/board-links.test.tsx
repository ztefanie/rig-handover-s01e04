import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board links', () => {
  it('links each night to its digest with counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    for (const night of ['2026-10-27', '2026-10-28']) {
      expect(html).toContain(`href="/digest/${night}"`);
    }
    expect(html).toMatch(/ok \d+ · retry \d+ · fail \d+/);
  });
});
