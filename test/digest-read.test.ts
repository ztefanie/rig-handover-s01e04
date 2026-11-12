import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs sorted by job and counts 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('summarises a job with retries', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the offset and the failing status', () => {
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync?.lastError).toBe('lock held');
    const backup = night?.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', runs: 1 });
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('keeps a row whose owner is null', () => {
    writeFileSync(
      join(dir, '2026-01-01.jsonl'),
      '{"at":"2026-01-01T05:00:00+01:00","job":"a","status":"ok","owner":null}\n',
    );
    const night = readNight(dir, '2026-01-01');
    expect(night?.rows).toHaveLength(1);
    expect(night?.rows[0]?.owner).toBeNull();
    expect(night?.rows[0]?.lastError).toBeNull();
  });

  it('returns null when the file is missing', () => {
    expect(readNight(dir, '2026-01-02')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(dir, '2026-01-03.jsonl'), '');
    expect(readNight(dir, '2026-01-03')).toEqual({ night: '2026-01-03', rows: [], badLines: 0 });
  });

  it('counts lines with a bad shape instead of throwing', () => {
    writeFileSync(
      join(dir, '2026-01-04.jsonl'),
      [
        '{"at":"2026-01-04T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-04T02:00:00+01:00","job":"a","status":"weird","owner":"x"}',
        '{"at":"not a date","job":"a","status":"ok","owner":"x"}',
        '[1,2]',
        '{"at":"2026-01-04T03:00:00+01:00","job":"a","status":"ok","owner":"x"',
      ].join('\n'),
    );
    const night = readNight(dir, '2026-01-04');
    expect(night?.badLines).toBe(4);
    expect(night?.rows).toHaveLength(1);
  });
});
