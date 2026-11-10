#!/usr/bin/env node
// CI test gate: reads JUnit XML reports and fails the job unless tests really ran.
//   node test-gate.mjs <junit.xml|dir>... [--allow .test-gate-allow] [--allow-path <path>]...
// Fails on: any failure/error, zero tests collected, a skipped test not named in the allowlist, and (fail closed) any report
// that does not parse cleanly or whose testcases disagree with its own suite totals (tests=, and failures=/errors= on
// suites without nested suites below; a node suite with child suites must say tests= its direct children).
// Discovery is fail closed too. Every path argument, AFTER the shell has expanded globs, must exist and must contribute at
// least one testcase (a directory is walked for *.xml). A missing path (an unexpanded glob arrives as its literal pattern, so
// a glob that matches nothing is a missing path) or a path with zero testcases fails the gate, however many tests the other
// paths have. The only escape is an explicit path allowlist: `--allow-path <path>` (repeatable) or the environment variable
// TEST_GATE_ALLOW_PATHS (comma or whitespace separated), each entry matched exactly against the argument as passed (a trailing
// slash is ignored). An allowlisted path may be missing or empty; it is still counted when it has tests. Use it for a path
// that legitimately has no tests (say a workspace that has no suite yet), never to quiet a suite that lost its tests.
// Never allowlist a glob: an entry is matched literally against the argument, so a glob entry (apps/*/junit) matches nothing
// the shell expanded. Allowlist the one concrete path that has no tests.
// A path that cannot be read (ELOOP, EACCES, EIO, ...) is a FAIL line naming the path, never a stack trace, and is never
// allowlistable. Duplicate or overlapping path arguments FAIL (they are not silently de-duplicated): the same path twice, or a
// directory with a file or directory inside it, is refused by name and the second path is not read, so tests= and files=
// never count a report twice. Name each report once.
// Limit: the check is per argument. Name each report directory (apps/*/junit), not a parent that also holds stray xml.
// Output: the first line is `TEST-GATE PASS|FAIL tests=N passed=N failed=N skipped=N (allowlisted N) files=N paths=<p>:<n>,...`
// (the part before ` paths=` is the format older consumers parse; paths= lists every argument with its testcase count).
// Two rules the gate does not change:
//  - The test step's EXIT CODE stays load-bearing. The gate reads reports; it does not replace the runner's exit code.
//    Never put continue-on-error or "|| true" on a test step: a node describe-level after() hook failure exits 1 but
//    leaves no trace in the JUnit (failures="0"), and only the exit code shows it.
//  - A failing node `todo` test is emitted as <skipped type="todo"> plus <failure>. It counts as FAILED and can not be
//    allowlisted (node itself exits 0 for it). A passing todo is a skip and needs an allowlist line.
// Writes a summary table to $GITHUB_STEP_SUMMARY so agents read CI counts instead of re-running suites.
// Vendored into each product repo by devops (docs/standards/pipeline.md section 1). Zero dependencies.
import { readFileSync, readdirSync, statSync, existsSync, appendFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// A small, dependency-free, fail-closed XML tokenizer for JUnit reports. It is not a general XML parser; it reads exactly
// what a test gate needs and refuses to guess about anything else:
//  - comments, CDATA sections and processing instructions are consumed whole, so a "</testcase>" or "<failure>" inside
//    CDATA or a comment is neither structure nor evidence (a CDATA block cannot hide a failure, a commented-out
//    testcase is not a test);
//  - start tags are parsed attribute by attribute, quote-aware: a quoted value may contain ">" "<" and "/>"
//    (node --test writes test names such as "a > b" unescaped), and only an unquoted ">" or "/>" ends the tag;
//  - anything that does not parse (a stray "<", a bad or unterminated tag, an unbalanced quote, a mismatched end tag,
//    an unterminated comment/CDATA, elements still open at the end of the file = truncation) is an ERROR, which the
//    gate turns into a failure, instead of being skipped silently;
//  - every <testsuite tests="N"> / <testsuites tests="N"> total is cross-checked against the testcases counted inside it.
// Attribute values are returned as written (still XML-escaped where the reporter escaped them): .test-gate-allow lines
// must match the report byte for byte. Matching is linear: every step consumes input, nothing backtracks.
const NAME = /[A-Za-z_:][\w:.-]*/y;
const WS = /\s+/y;
const at = (re, s, i) => { re.lastIndex = i; return re.exec(s); };

function* tokenize(xml, fail) {
  let i = 0;
  while (true) {
    const from = i;
    i = xml.indexOf('<', i);
    const gap = xml.slice(from, i < 0 ? xml.length : i);
    if (gap.trim() !== '') yield { type: 'text' };
    if (i < 0) return;
    const here = i;
    const near = () => JSON.stringify(xml.slice(here, here + 40));
    const skipTo = (open, close, what) => {
      const end = xml.indexOf(close, here + open.length);
      if (end < 0) { fail(`unterminated ${what} at offset ${here} (truncated file?)`); return false; }
      i = end + close.length;
      return true;
    };
    if (xml.startsWith('<!--', i)) { if (!skipTo('<!--', '-->', 'comment')) return; continue; }
    if (xml.startsWith('<![CDATA[', i)) { if (!skipTo('<![CDATA[', ']]>', 'CDATA section')) return; continue; }
    if (xml.startsWith('<?', i)) { if (!skipTo('<?', '?>', 'processing instruction')) return; continue; }
    if (xml.startsWith('<!', i)) { fail(`unsupported markup declaration ${near()} at offset ${here}`); return; }
    if (xml.startsWith('</', i)) {
      const n = at(NAME, xml, i + 2);
      if (!n) { fail(`malformed end tag ${near()} at offset ${here}`); return; }
      let j = i + 2 + n[0].length;
      const w = at(WS, xml, j); if (w) j += w[0].length;
      if (xml[j] !== '>') { fail(`malformed end tag ${near()} at offset ${here}`); return; }
      i = j + 1;
      yield { type: 'end', name: n[0] };
      continue;
    }
    const n = at(NAME, xml, i + 1);
    if (!n) { fail(`stray "<" ${near()} at offset ${here}`); return; }
    let j = i + 1 + n[0].length;
    const attrs = new Map();
    let tag = null, dup = null;
    while (true) {
      const w = at(WS, xml, j);
      const gap = w ? w[0].length : 0;
      j += gap;
      if (xml[j] === '>') { i = j + 1; tag = { type: 'start', name: n[0], attrs, selfClosing: false }; break; }
      if (xml[j] === '/' && xml[j + 1] === '>') { i = j + 2; tag = { type: 'start', name: n[0], attrs, selfClosing: true }; break; }
      const a = gap ? at(NAME, xml, j) : null; // attributes must be separated by whitespace
      if (!a) break;
      j += a[0].length;
      const eq = at(WS, xml, j); if (eq) j += eq[0].length;
      if (xml[j] !== '=') break;
      j += 1;
      const w2 = at(WS, xml, j); if (w2) j += w2[0].length;
      const q = xml[j];
      if (q !== '"' && q !== "'") break;
      const end = xml.indexOf(q, j + 1);
      if (end < 0) break;
      if (attrs.has(a[0])) { dup = a[0]; break; }
      attrs.set(a[0], xml.slice(j + 1, end));
      j = end + 1;
    }
    if (!tag && dup) { fail(`<${n[0]}> has the attribute ${dup} twice at offset ${here}`); return; }
    if (!tag) { fail(`<${n[0]}> start tag does not parse: ${near()} at offset ${here}`); return; }
    yield tag;
  }
}

const isSuite = (name) => name === 'testsuite' || name === 'testsuites';
const CORE = new Set(['testcase', 'testsuite', 'testsuites', 'failure', 'error', 'skipped']);
const count = (v) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN);

// Linear in the size of the report: every token is handled in O(1). The open elements live on a stack, but nothing ever
// searches or iterates it: the open testcase is a variable, and every counter is handed to the parent when its child
// closes. (A test pins this by counting the array operations during a deep report.)
export function summarizeJunit(xmls, labels = []) {
  let tests = 0, failed = 0, skipped = 0;
  const skippedNames = [], failedNames = [], errors = [];
  xmls.forEach((xml, idx) => {
    const where = labels[idx] ?? `report ${idx + 1}`;
    let broken = false;
    const fail = (msg) => { broken = true; errors.push(`${where}: ${msg}`); };
    const stack = [];
    let tc = null; // the open testcase, if any
    let roots = 0;

    const parentSuite = () => { const p = stack[stack.length - 1]; return p && isSuite(p.name) ? p : null; };

    const close = (e) => {
      const parent = parentSuite();
      if (e.name === 'testcase') {
        tc = null;
        tests += 1;
        // a failure or error wins over a skip on the same testcase (a failing node `todo` test emits both): a failure
        // never hides behind <skipped/>, and so a failing todo can not be allowlisted
        if (e.failure || e.error) { failed += 1; failedNames.push(e.tcName); }
        else if (e.skipped) { skipped += 1; skippedNames.push(e.tcName); }
        if (parent) {
          parent.direct += 1; parent.kids += 1; parent.all += 1;
          if (e.failure) parent.failures += 1;
          if (e.error) parent.errors += 1;
        }
        return;
      }
      if (!isSuite(e.name)) return;
      const label = `<${e.name} name="${e.label}">`;
      // tests="N": node counts its direct children (testcases plus child suites); vitest and jest-junit count every
      // testcase inside, and write flat suites. Exactly three readings are accepted: all descendant testcases, direct
      // testcases, direct children. A <testsuite> that holds a child suite is node's nesting, so only node's reading
      // (direct children) is accepted there: all-descendants would let a deleted passing sibling go unnoticed
      // (outer{a, in1{b,c}} says 2 = children; without a, the 2 descendants b, c would match the all reading).
      const nested = e.name === 'testsuite' && e.hasChildSuite;
      if (e.attrs.has('tests')) {
        const want = count(e.attrs.get('tests'));
        if (Number.isNaN(want)) fail(`${label} has tests="${e.attrs.get('tests')}", which is not a count`);
        else if (nested ? want !== e.kids : want !== e.all && want !== e.direct && want !== e.kids) fail(`${label} says tests="${want}" but ${e.all} testcases (${e.direct} direct, ${e.kids} direct children) were counted inside it`);
      }
      // failures= / errors= count the testcases with a <failure> / <error> child. Node also counts a child suite that
      // holds failures, so a suite with nested suites below it is not checked (no reporter-independent model there).
      const deep = e.nestedBelow || (e.name === 'testsuite' && e.hasChildSuite);
      if (!deep) {
        for (const [attr, got] of [['failures', e.failures], ['errors', e.errors]]) {
          if (!e.attrs.has(attr)) continue;
          const want = count(e.attrs.get(attr));
          if (Number.isNaN(want)) fail(`${label} has ${attr}="${e.attrs.get(attr)}", which is not a count`);
          else if (want !== got) fail(`${label} says ${attr}="${want}" but ${got} testcases with <${attr === 'failures' ? 'failure' : 'error'}> were counted inside it`);
        }
      }
      if (parent) {
        parent.all += e.all; parent.failures += e.failures; parent.errors += e.errors;
        parent.nestedBelow ||= e.nestedBelow || (e.name === 'testsuite' && parent.name === 'testsuite');
      }
    };

    for (const t of tokenize(xml, fail)) {
      if (t.type === 'text') {
        if (stack.length === 0) { fail('text outside the root element'); break; }
      } else if (t.type === 'start') {
        const lower = t.name.toLowerCase();
        const local = lower.slice(lower.lastIndexOf(':') + 1);
        if (CORE.has(local) && !CORE.has(t.name)) { fail(`<${t.name}> looks like a JUnit element but is namespaced or differently cased`); break; }
        if (stack.length === 0 && ++roots > 1) { fail('more than one root element'); break; }
        if (t.name === 'testcase') {
          if (tc) { fail('nested <testcase>'); break; }
          tc = { name: 'testcase', tcName: t.attrs.get('name') ?? '?', skipped: false, failure: false, error: false };
          stack.push(tc);
        } else if (isSuite(t.name)) {
          const p = parentSuite();
          if (p) { p.kids += 1; p.hasChildSuite = true; }
          stack.push({ name: t.name, label: t.attrs.get('name') ?? '?', attrs: t.attrs, all: 0, direct: 0, kids: 0, failures: 0, errors: 0, nestedBelow: false, hasChildSuite: false });
        } else {
          if (t.name === 'skipped' || t.name === 'failure' || t.name === 'error') {
            if (!tc) { fail(`<${t.name}> outside a <testcase>`); break; }
            tc[t.name] = true;
          }
          if (!t.selfClosing) stack.push({ name: t.name });
        }
        if (t.selfClosing && (t.name === 'testcase' || isSuite(t.name))) close(stack.pop());
      } else {
        const e = stack.pop();
        if (!e || e.name !== t.name) { fail(`</${t.name}> does not match ${e ? `<${e.name}>` : 'any open element'}`); break; }
        close(e);
      }
    }
    if (!broken && stack.length) fail(`<${stack[stack.length - 1].name}> is never closed (truncated file?)`);
  });
  return { tests, failed, skipped, passed: tests - failed - skipped, skippedNames, failedNames, errors };
}

export function gate(s, allow = []) {
  const unlisted = s.skippedNames.filter((n) => !allow.includes(n));
  const problems = (s.errors ?? []).map((e) => `malformed JUnit, not trusted: ${e}`);
  if (s.tests === 0) problems.push('zero tests collected — a green with no tests is red');
  if (s.failed) problems.push(`${s.failed} failed: ${s.failedNames.slice(0, 10).join(', ')}`);
  if (unlisted.length) problems.push(`${unlisted.length} skipped without allowlist entry: ${unlisted.slice(0, 10).join(', ')}`);
  return { ok: problems.length === 0, problems };
}

const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => walk(join(p, f))) : p.endsWith('.xml') ? [p] : []);
const norm = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

// Reads every path argument on its own, so a missing path or a path with no testcases is a finding of that path and not
// lost in the aggregate. Returns the combined summary plus the per-path counts and the discovery problems.
export function discover(paths, allowPaths = [], read = readFileSync) {
  const allowed = new Set(allowPaths.map(norm));
  const perPath = [], problems = [], files = [], summaries = [];
  const seen = [];
  for (const p of paths) {
    const ok = allowed.has(norm(p));
    let st;
    try { st = statSync(p); } catch (e) {
      perPath.push({ path: p, tests: 0, files: 0 });
      if (e.code === 'ENOENT' || e.code === 'ENOTDIR') {
        if (!ok) problems.push(`path does not exist: ${p} (an unexpanded glob matches nothing; list the path in --allow-path or TEST_GATE_ALLOW_PATHS if it legitimately has no report)`);
      } else problems.push(`cannot read path: ${p} (${e.code ?? e.message})`);
      continue;
    }
    let key;
    try { key = realpathSync(p); } catch { key = resolve(p); }
    const clash = seen.find((q) => key === q.key || key.startsWith(q.key + sep) || q.key.startsWith(key + sep));
    if (clash) {
      const same = key === clash.key;
      perPath.push({ path: p, tests: 0, files: 0 });
      problems.push(`${same ? 'duplicate' : 'overlapping'} path: ${p} ${same ? 'is the same as' : 'overlaps'} ${clash.path} (name each report once; it was not counted twice)`);
      continue;
    }
    seen.push({ key, path: p });
    let found = [], s, cur = null;
    try {
      found = walk(p);
      s = summarizeJunit(found.map((f) => { cur = f; return read(f, 'utf8'); }), found);
    } catch (e) {
      perPath.push({ path: p, tests: 0, files: 0 });
      problems.push(`cannot read path: ${e.path ?? cur ?? p} (${e.code ?? e.message}) while reading ${p}`);
      continue;
    }
    perPath.push({ path: p, tests: s.tests, files: found.length });
    summaries.push(s);
    files.push(...found);
    if (s.tests === 0 && !ok) problems.push(`path contributes zero testcases: ${p} (${found.length} report file${found.length === 1 ? '' : 's'}; list the path in --allow-path or TEST_GATE_ALLOW_PATHS if it legitimately has no tests)`);
  }
  const total = { tests: 0, failed: 0, skipped: 0, passed: 0, skippedNames: [], failedNames: [], errors: [] };
  for (const s of summaries) {
    total.tests += s.tests; total.failed += s.failed; total.skipped += s.skipped; total.passed += s.passed;
    total.skippedNames.push(...s.skippedNames); total.failedNames.push(...s.failedNames); total.errors.push(...s.errors);
  }
  return { summary: total, perPath, problems, files };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const take = (flag) => { const out = []; for (let i = args.indexOf(flag); i >= 0; i = args.indexOf(flag)) out.push(args.splice(i, 2)[1]); return out; };
  const allowFiles = take('--allow');
  const allowFile = allowFiles.length ? allowFiles[allowFiles.length - 1] : '.test-gate-allow';
  const allowPaths = [...take('--allow-path'), ...(process.env.TEST_GATE_ALLOW_PATHS ?? '').split(/[,\s]+/)].filter(Boolean);
  const allow = existsSync(allowFile) ? readFileSync(allowFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
  const d = discover(args, allowPaths);
  const s = d.summary;
  const g = gate(s, allow);
  const problems = [...d.problems, ...g.problems];
  const ok = problems.length === 0;
  const line = `tests=${s.tests} passed=${s.passed} failed=${s.failed} skipped=${s.skipped} (allowlisted ${s.skipped - s.skippedNames.filter((n) => !allow.includes(n)).length}) files=${d.files.length} paths=${d.perPath.map((p) => `${p.path}:${p.tests}`).join(',')}`;
  console.log(`TEST-GATE ${ok ? 'PASS' : 'FAIL'} ${line}`);
  for (const p of problems) console.log(`  - ${p}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Test gate: ${ok ? '✅ pass' : '❌ fail'}\n\n| tests | passed | failed | skipped | report files |\n|---|---|---|---|---|\n| ${s.tests} | ${s.passed} | ${s.failed} | ${s.skipped} | ${d.files.length} |\n\n| path | tests |\n|---|---|\n${d.perPath.map((p) => `| ${p.path} | ${p.tests} |`).join('\n')}\n\n${problems.map((p) => `- ${p}`).join('\n')}\n`);
  }
  process.exit(ok ? 0 : 1);
}
