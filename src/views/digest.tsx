import type { DigestNight, DigestRow } from '../digest/types.js';

const dash = '—';

function flags(row: DigestRow): string[] {
  const out: string[] = [];
  if (row.retries >= 3) out.push('many retries');
  if (row.lastStatus === 'fail') out.push('failed');
  return out;
}

export function DigestPage({ digest }: { digest: DigestNight }) {
  return (
    <>
      <h1>digest {digest.night}</h1>
      {digest.badLines > 0 ? (
        <p class="warn">{digest.badLines} unreadable line{digest.badLines === 1 ? '' : 's'} skipped</p>
      ) : null}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>last</th>
              <th>last error</th><th>first</th><th>last at</th><th>flag</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const marks = flags(row);
              return (
                <tr class={marks.length > 0 ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? dash}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? dash}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                  <td>{marks.length > 0 ? marks.join(', ') : dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
