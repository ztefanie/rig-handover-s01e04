export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  // null in the log: keep the row, views show "—".
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  // Error of the last run that carried one; null when none did.
  lastError: string | null;
  // ISO 8601 with the offset from the log, never converted.
  firstAt: string;
  lastAt: string;
};

export type DigestNight = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown.
  badLines: number;
};

// Reads runs/<night>.jsonl. Returns null when the file does not exist (route answers 404);
// an empty file returns rows: [].
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;

// Implemented in src/digest/read.ts (issue #2):
//   export const readNight: ReadNight
