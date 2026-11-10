// Offline test of deploy/staging/deploy-entry: bash runs a sed copy of the entry (paths and timing swapped in) with a fake
// `docker` and `logger` in a private bin directory. The fakes log argv, the image and the token stdin to files.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const ENTRY = new URL('../deploy/staging/deploy-entry', import.meta.url).pathname;
const original = readFileSync(ENTRY, 'utf8');

const SHA = 'a'.repeat(40);
const PREV = 'b'.repeat(40);
const DIG = 'sha256:' + 'c'.repeat(64);
const PDIG = 'sha256:' + 'd'.repeat(64);
const TOKEN = 'ghs_' + 'X1y2Z3'.repeat(8);

// The lines the harness rewrites: each must match exactly once in the real entry (E8), so a refactor cannot make this
// test run something other than the real paths.
const TARGETS = [
  [/^readonly STACK=.*$/m, (w) => `readonly STACK=${w}/stack`],
  [/^readonly INSTALLED=.*$/m, (w) => `readonly INSTALLED=${w}/INSTALLED`],
  [/^readonly CFGPARENT=.*$/m, (w) => `readonly CFGPARENT=${w}/cfg`],
  [/^readonly WAIT_S=.*$/m, () => 'readonly WAIT_S=1'],
  [/^readonly POLL_S=.*$/m, () => 'readonly POLL_S=0'],
  [/^PATH=\/usr\/local\/sbin.*$/m, (w) => `PATH=${w}/bin`],
];

function harness({prev = null, healthy = true, prevHealthy = true} = {}) {
  const w = mkdtempSync(join(tmpdir(), 'hp-entry-'));
  for (const d of ['bin', 'stack', 'cfg', 'state']) mkdirSync(join(w, d));
  writeFileSync(join(w, 'INSTALLED'), 'installed\n');
  writeFileSync(join(w, 'stack/compose.yml'), 'name: x\n');
  for (const t of ['sed', 'head', 'date', 'mktemp', 'find', 'rm', 'mv', 'env', 'sleep', 'cat']) {
    const p = spawnSync('bash', ['-c', `command -v ${t}`], {encoding: 'utf8'}).stdout.trim();
    symlinkSync(p, join(w, 'bin', t));
  }
  let copy = original;
  for (const [re, f] of TARGETS) copy = copy.replace(re, f(w));
  writeFileSync(join(w, 'entry'), copy);
  if (prev) {
    writeFileSync(join(w, 'stack/deployed.json'), `{"sha":"${prev.sha}","digest":"${prev.digest}","at":"2026-01-01T00:00:00Z","previous":null}\n`);
  }
  // answers: which sha each image digest reports on /health
  const answers = [`${DIG} ${healthy ? SHA : 'f'.repeat(40)}`];
  if (prev) answers.push(`${prev.digest} ${prevHealthy ? prev.sha : 'e'.repeat(40)}`);
  writeFileSync(join(w, 'state/answers'), answers.join('\n') + '\n');
  const fake = `#!/bin/bash
S=${w}/state
img=\${HANDPRESS_IMAGE:-}
printf '%s | IMG=%s | CFG=%s\\n' "$*" "$img" "\${DOCKER_CONFIG:-}" >> $S/docker.log
case "$1" in
  login) cat > $S/login.stdin; mkdir -p "$DOCKER_CONFIG"; echo '{"auths":{}}' > "$DOCKER_CONFIG/config.json"; exit 0 ;;
  compose)
    case " $* " in
      *" exec "*) d=\${img##*@}; sha=$(while read -r a b; do [ "$a" = "$d" ] && echo "$b"; done < $S/answers)
                  [ -n "$sha" ] && printf '{"status":"ok","sha":"%s"}\\n' "$sha"; exit 0 ;;
    esac ;;
esac
exit 0
`;
  writeFileSync(join(w, 'bin/docker'), fake);
  chmodSync(join(w, 'bin/docker'), 0o755);
  writeFileSync(join(w, 'bin/logger'), `#!/bin/bash\nprintf '%s\\n' "$*" >> ${w}/state/logger.log\n`);
  chmodSync(join(w, 'bin/logger'), 0o755);
  return w;
}

function run(w, command, input = TOKEN + '\n', args = ['staging']) {
  return spawnSync('bash', [join(w, 'entry'), ...args], {
    input,
    encoding: 'utf8',
    env: {SSH_ORIGINAL_COMMAND: command, HOME: w, PATH: '/usr/bin:/bin'},
    timeout: 30000,
  });
}
const read = (w, f) => (existsSync(join(w, f)) ? readFileSync(join(w, f), 'utf8') : '');
const dockerLog = (w) => read(w, 'state/docker.log');
const logger = (w) => read(w, 'state/logger.log');
const runDirs = (w) => readdirSync(join(w, 'cfg')).filter((n) => n.startsWith('run.'));
const deployCmd = `deploy ${SHA} ${DIG}`;

test('E1 every wrong command is refused with 111 and a refused: line', () => {
  const bad = [
    [`deploy ${SHA.slice(0, 7)} ${DIG}`, 'staging'],
    [`deploy ${SHA} sha-${SHA.slice(0, 7)}`, 'staging'],
    [`deploy ${SHA} ${DIG} extra`, 'staging'],
    [`deploy ${SHA} ${DIG}; id`, 'staging'],
    [`deploy ${SHA.toUpperCase()} ${DIG}`, 'staging'],
    ['', 'staging'],
    ['read-tag now', 'staging'],
    [deployCmd, 'production'],
  ];
  for (const [cmd, arg] of bad) {
    const w = harness();
    const r = run(w, cmd, TOKEN + '\n', [arg]);
    assert.equal(r.status, 111, `${JSON.stringify(cmd)} ${arg}: status ${r.status}`);
    assert.match(logger(w), /refused:/, JSON.stringify(cmd));
    assert.equal(dockerLog(w), '', `docker ran for ${JSON.stringify(cmd)}`);
  }
});

test('E2 the token is only docker login stdin; a bad or doubled token is refused', () => {
  const w = harness();
  const r = run(w, deployCmd);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(w, 'state/login.stdin'), TOKEN);
  assert.ok(!dockerLog(w).includes(TOKEN), 'token in an argv log');
  assert.match(dockerLog(w), /login ghcr\.io -u github-actions --password-stdin/);
  assert.ok(!logger(w).includes(TOKEN));
  for (const input of [TOKEN + '\nsecond line\n', 'notatoken\n', 'ghs_short\n', '']) {
    const w2 = harness();
    const r2 = run(w2, deployCmd, input);
    assert.equal(r2.status, 111, JSON.stringify(input));
    assert.equal(dockerLog(w2), '');
  }
});

test('E3 digest only: every image ends @sha256, up never pulls, nothing pulls after logout', () => {
  const w = harness();
  assert.equal(run(w, deployCmd).status, 0);
  const lines = dockerLog(w).trim().split('\n');
  for (const l of lines.filter((x) => x.startsWith('compose'))) assert.match(l, /IMG=ghcr\.io\/bahadirbirsoz\/bahadirbirsoz-handpress@sha256:[0-9a-f]{64} /, l);
  for (const l of lines.filter((x) => / up /.test(` ${x} `))) assert.match(l, /--pull never/);
  const out = lines.findIndex((l) => l.startsWith('logout'));
  assert.ok(out > 0, 'no logout');
  assert.ok(lines.slice(out).every((l) => !/ pull( |$)/.test(l.replace(/--pull never/, ''))), 'a pull after logout');
  assert.ok(lines.some((l) => / pull web /.test(l + ' ')));
  assert.ok(!/:sha-/.test(dockerLog(w)));
});

test('E4 success records deployed.json with the previous pair, logs deployed, removes the config dir', () => {
  const w = harness({prev: {sha: PREV, digest: PDIG}});
  const r = run(w, deployCmd);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(read(w, 'stack/deployed.json'));
  assert.deepEqual([j.sha, j.digest, j.previous], [SHA, DIG, {sha: PREV, digest: PDIG}]);
  assert.match(j.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.match(logger(w), new RegExp(`deployed ${SHA} ${DIG}`));
  assert.deepEqual(runDirs(w), []);
  assert.equal(existsSync(join(w, 'stack/.deployed.json.new')), false);
});

test('E5 mismatch with a previous deploy restores it, exits 1, leaves deployed.json untouched', () => {
  const w = harness({prev: {sha: PREV, digest: PDIG}, healthy: false});
  const before = read(w, 'stack/deployed.json');
  const r = run(w, deployCmd);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(read(w, 'stack/deployed.json'), before);
  const ups = dockerLog(w).split('\n').filter((l) => / up /.test(` ${l} `));
  assert.ok(ups.some((l) => l.includes(`@${PDIG}`)), 'no up with the previous digest');
  assert.equal(logger(w).split('\n').filter((l) => l.includes(`restored ${PREV}`)).length, 1);
  assert.deepEqual(runDirs(w), []);
});

test('E6 mismatch on a first deploy: down without -v, exit 3, no deployed.json', () => {
  const w = harness({healthy: false});
  const r = run(w, deployCmd);
  assert.equal(r.status, 3, r.stderr);
  const downs = dockerLog(w).split('\n').filter((l) => / down( |$)/.test(l));
  assert.equal(downs.length, 1);
  assert.ok(!/ -v/.test(downs[0]) && !/--volumes/.test(downs[0]));
  assert.equal(existsSync(join(w, 'stack/deployed.json')), false);
  assert.match(logger(w), /no previous deploy, stack stopped/);
  assert.deepEqual(runDirs(w), []);
});

test('E7 read-tag prints the last good pair, or none', () => {
  const w = harness({prev: {sha: PREV, digest: PDIG}});
  const r = run(w, 'read-tag', 'ignored\n');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, `${PREV} ${PDIG}\n`);
  const w2 = harness();
  assert.equal(run(w2, 'read-tag', '').stdout, 'none\n');
  assert.equal(dockerLog(w2), '');
});

test('E8 the entry holds each rewritten line once and no environment hook', () => {
  for (const [re] of TARGETS) assert.equal(original.match(new RegExp(re.source, 'gm'))?.length, 1, String(re));
  assert.ok(!/\$\{(HANDPRESS_|ENTRY_)/.test(original));
  assert.ok(!/\bdown\b[^\n]*(?: -v|--volumes)/.test(original));
});

test('E9 the token is gone before anything starts: logout precedes the first up', () => {
  const w = harness();
  assert.equal(run(w, deployCmd).status, 0);
  const lines = dockerLog(w).trim().split('\n');
  const out = lines.findIndex((l) => l.startsWith('logout'));
  const up = lines.findIndex((l) => / up /.test(` ${l} `));
  assert.ok(out >= 0 && up >= 0 && out < up, `logout at ${out}, first up at ${up}`);
});

test('E10 the restore also fails: down without -v, exit 3, restore failed logged, deployed.json untouched', () => {
  const w = harness({prev: {sha: PREV, digest: PDIG}, healthy: false, prevHealthy: false});
  const before = read(w, 'stack/deployed.json');
  const r = run(w, deployCmd);
  assert.equal(r.status, 3, r.stderr);
  const downs = dockerLog(w).split('\n').filter((l) => / down( |$)/.test(l));
  assert.equal(downs.length, 1);
  assert.ok(downs[0].includes(`@${PDIG}`), 'down not on the previous digest');
  assert.ok(!/ -v/.test(downs[0]) && !/--volumes/.test(downs[0]));
  assert.match(logger(w), /restore failed/);
  assert.equal(read(w, 'stack/deployed.json'), before);
  assert.deepEqual(runDirs(w), []);
});

test('E11 a docker-credential-* helper on PATH is refused before docker runs', () => {
  const w = harness();
  writeFileSync(join(w, 'bin/docker-credential-fake'), '#!/bin/bash\nexit 0\n');
  chmodSync(join(w, 'bin/docker-credential-fake'), 0o755);
  const r = run(w, deployCmd);
  assert.equal(r.status, 111, r.stderr);
  assert.match(logger(w), /refused: credential helper on PATH/);
  assert.equal(dockerLog(w), '');
});

// The U18 hook row admits every job of ci.yml on a push to main, so the routing is what keeps repository and third-party
// code off the deploy host: only deploy-staging may use the self-hosted runner, and it may have no `uses:` step.
test('E12 only deploy-staging runs self-hosted, and it uses no actions', () => {
  const yml = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').split('\n');
  const start = yml.findIndex((l) => l === 'jobs:');
  assert.ok(start >= 0, 'no jobs:');
  const jobs = {};
  let cur = null;
  for (const l of yml.slice(start + 1)) {
    const m = l.match(/^ {2}"?([\w-]+)"?:\s*$/);
    if (m) { cur = m[1]; jobs[cur] = []; } else if (cur) jobs[cur].push(l);
  }
  assert.ok(jobs['deploy-staging'], 'no deploy-staging job');
  assert.ok(Object.keys(jobs).length >= 4, 'job parse found too few jobs');
  for (const [name, body] of Object.entries(jobs)) {
    const runsOn = body.filter((l) => /^ {4}runs-on:/.test(l)).join('\n');
    assert.ok(runsOn, `${name} has no runs-on`);
    if (name !== 'deploy-staging') assert.ok(!/self-hosted/.test(runsOn), `${name} runs on a self-hosted runner`);
    else {
      assert.match(runsOn, /self-hosted/);
      assert.ok(!body.some((l) => /^\s*-?\s*uses:/.test(l)), 'deploy-staging has a uses: step');
    }
  }
});
