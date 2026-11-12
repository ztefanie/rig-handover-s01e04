import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestNight } from '../src/digest/types.js';

let runsDir: string;
let app: ReturnType<typeof createApp>;

const line = (at: string, job: string, status: string, owner: string | null = 'lane-07') =>
  JSON.stringify({ at, job, status, owner });

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(
    join(runsDir, '2030-01-01.jsonl'),
    [
      line('2030-01-01T23:00:00+01:00', 'zeta/sync', 'ok'),
      line('2030-01-01T23:05:00+01:00', 'alpha/build', 'retry'),
      line('2030-01-01T23:10:00+01:00', 'alpha/build', 'fail'),
      line('2030-01-01T23:15:00+01:00', 'mid/clean', 'ok', null),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2030-01-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2030-01-03.jsonl'),
    [
      line('2030-01-03T23:00:00+01:00', 'beta/job', 'ok'),
      'this is not json',
      line('2030-01-03T23:05:00+01:00', 'alpha/job', 'ok'),
    ].join('\n') + '\n',
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

async function json(night: string) {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as DigestNight };
}

describe('GET /digest/:night', () => {
  it('renders the rows with 200', async () => {
    const res = await app.request('/digest/2030-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['alpha/build', 'mid/clean', 'zeta/sync']) expect(html).toContain(job);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/digest/2030-12-31');
    expect(res.status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2030-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders when a line is bad', async () => {
    const res = await app.request('/digest/2030-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha/job');
    expect(html).toContain('beta/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows and badLines with 200', async () => {
    const { res, body } = await json('2030-01-01');
    expect(res.status).toBe(200);
    expect(body.night).toBe('2030-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/build', 'mid/clean', 'zeta/sync']);
  });

  it('answers 404 json for a night with no file', async () => {
    const res = await app.request('/api/digest/2030-12-31');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('returns no rows for an empty night', async () => {
    const { res, body } = await json('2030-01-02');
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line and keeps the other rows', async () => {
    const { res, body } = await json('2030-01-03');
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'beta/job']);
  });
});

describe('page and json agree', () => {
  it('list the same jobs in the same order', async () => {
    const { body } = await json('2030-01-01');
    const html = await (await app.request('/digest/2030-01-01')).text();
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
