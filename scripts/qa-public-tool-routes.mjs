import { readFile } from 'node:fs/promises';

const source = await readFile('/home/ubuntu/wasl-file-studio/client/src/lib/tools.ts', 'utf8');
const slugs = [...source.matchAll(/slug: "([^"]+)"/g)].map(match => match[1]);
const root = 'https://waslfile-b7bks7br.manus.space';
const results = [];
for (const slug of slugs) {
  try {
    const response = await fetch(`${root}/${slug}`, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    results.push({ slug, status: response.status });
  } catch (error) { results.push({ slug, status: 0, error: error instanceof Error ? error.name : 'REQUEST_FAILED' }); }
}
const failed = results.filter(item => item.status !== 200);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
