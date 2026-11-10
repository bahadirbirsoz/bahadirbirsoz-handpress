// Writes dist/health.json for the sha it is given: {"status":"ok","sha":"<sha40>"}. The Dockerfile build stage and the
// build-test job both call it, so the file that is tested and the file that ships come from one writer.
import {mkdirSync, writeFileSync} from 'node:fs';

const sha = process.argv[2] ?? '';
if (!/^[0-9a-f]{40}$/.test(sha)) {
  console.error('write-health: the argument must be a full 40-character lowercase hex sha');
  process.exit(1);
}
mkdirSync('dist', {recursive: true});
writeFileSync('dist/health.json', JSON.stringify({status: 'ok', sha}) + '\n');
