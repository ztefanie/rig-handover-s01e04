import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestNight, DigestRow, ReadNight, RunStatus } from './types.js';

type RunLine = {
  at: string;
  time: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && STATUSES.includes(value);
}

// Parse one log line at the edge; null means the line is bad.
function parseLine(text: string): RunLine | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const { at, job, status, owner, error } = raw;
  if (typeof at !== 'string') return null;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, time, job, status, owner, error: error ?? null };
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if (isRecord(err) && err.code === 'ENOENT') return null;
    throw err;
  }
}

function toRow(job: string, lines: RunLine[]): DigestRow {
  // Order by instant; ties keep file order (sort is stable).
  const ordered = [...lines].sort((a, b) => a.time - b.time);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) throw new Error(`no lines for job ${job}`);
  let lastError: string | null = null;
  let owner: string | null = null;
  for (const line of ordered) {
    if (line.error !== null) lastError = line.error;
    if (line.owner !== null) owner = line.owner;
  }
  return {
    job,
    owner,
    runs: ordered.length,
    retries: ordered.filter((l) => l.status === 'retry').length,
    lastStatus: last.status,
    lastError,
    firstAt: first.at,
    lastAt: last.at,
  };
}

export const readNight: ReadNight = (runsDir, night): DigestNight | null => {
  const text = readText(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;
  for (const rawLine of text.split('\n')) {
    if (rawLine.trim() === '') continue;
    const line = parseLine(rawLine);
    if (line === null) {
      badLines += 1;
      continue;
    }
    const lines = byJob.get(line.job);
    if (lines) lines.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows = [...byJob.entries()]
    .map(([job, lines]) => toRow(job, lines))
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
