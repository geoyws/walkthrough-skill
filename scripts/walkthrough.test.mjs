// node --test scripts/walkthrough.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./walkthrough.mjs', import.meta.url));
const SKILL_DIR = path.dirname(path.dirname(SCRIPT));

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  return { status: result.status, out: result.stdout || '', err: result.stderr || '' };
}

function wt(args, repo) {
  return run([SCRIPT, ...args, '--repo', repo], repo);
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-fixture-'));
  const repo = fs.realpathSync(dir);
  git(['init', '-b', 'main'], repo);
  git(['config', 'user.name', 'Walkthrough Test'], repo);
  git(['config', 'user.email', 'walkthrough@test'], repo);
  git(['config', 'commit.gpgsign', 'false'], repo);
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    `${JSON.stringify({ name: 'fixture', private: true, version: '0.0.0', scripts: { build: 'true' } }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(repo, 'apps/x'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, 'apps/x/package.json'),
    `${JSON.stringify({ name: '@fixture/x', description: 'the x app', scripts: { dev: 'true' } }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(repo, 'docs/adr'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/adr/0001-x.md'), '# ADR-0001: use x\n\nStatus: accepted\n');
  git(['add', '-A'], repo);
  git(['commit', '-m', 'initial'], repo);
  return repo;
}

test('init scaffolds the site, vendors the script and wires package.json', () => {
  const repo = fixture();
  const init = wt(['init'], repo);
  assert.equal(init.status, 0, init.err);

  for (const rel of [
    'docs/walkthrough/walkthrough.config.json',
    'docs/walkthrough/bin/walkthrough.mjs',
    'docs/walkthrough/.vitepress/config.mts',
    'docs/walkthrough/.vitepress/theme/index.ts',
    'docs/walkthrough/.vitepress/theme/Layout.vue',
    'docs/walkthrough/index.md',
    'docs/walkthrough/guide/reading-order.md',
    'docs/walkthrough/guide/traps.md',
    'docs/walkthrough/guide/glossary.md',
    'docs/walkthrough/areas/x.md',
    'docs/walkthrough/manifest.json',
    'docs/walkthrough/generated/inventory.md',
    'docs/walkthrough/generated/submodules.md',
    'docs/walkthrough/generated/scripts.md',
    'docs/walkthrough/generated/adrs.md',
    'docs/walkthrough/generated/changes.md',
    'docs/walkthrough/generated/drift.md',
  ]) {
    assert.ok(fs.existsSync(path.join(repo, rel)), `missing ${rel}`);
  }

  // the vendored copy is byte-identical and runs standalone, with no --repo flag
  assert.equal(
    fs.readFileSync(path.join(repo, 'docs/walkthrough/bin/walkthrough.mjs'), 'utf8'),
    fs.readFileSync(SCRIPT, 'utf8'),
  );
  const standalone = run([path.join(repo, 'docs/walkthrough/bin/walkthrough.mjs'), 'check'], os.tmpdir());
  assert.equal(standalone.status, 0, standalone.err);
  assert.match(standalone.out, /^FRESH [0-9a-f]{10}$/m);

  const rawPkg = fs.readFileSync(path.join(repo, 'package.json'), 'utf8');
  assert.ok(rawPkg.endsWith('}\n'), 'package.json keeps a trailing newline');
  assert.match(rawPkg, /\n  "scripts": \{/, 'package.json keeps 2-space indent');
  const pkg = JSON.parse(rawPkg);
  assert.deepEqual(Object.keys(pkg).slice(0, 4), ['name', 'private', 'version', 'scripts'], 'key order preserved');
  assert.equal(pkg.scripts.build, 'true', 'existing scripts untouched');
  for (const name of [
    'walkthrough:refresh',
    'walkthrough:check',
    'walkthrough:build',
    'walkthrough:dev',
    'walkthrough:serve',
  ]) {
    assert.ok(pkg.scripts[name], `missing script ${name}`);
  }
  assert.equal(pkg.devDependencies.vitepress, '^1.6.4');

  // the generated layer reflects the tree
  const inventory = fs.readFileSync(path.join(repo, 'docs/walkthrough/generated/inventory.md'), 'utf8');
  assert.match(inventory, /apps\/x/);
  assert.match(inventory, /the x app/);
  const adrs = fs.readFileSync(path.join(repo, 'docs/walkthrough/generated/adrs.md'), 'utf8');
  assert.match(adrs, /ADR-0001: use x/);
  assert.match(adrs, /accepted/);
  const siteConfig = fs.readFileSync(path.join(repo, 'docs/walkthrough/.vitepress/config.mts'), 'utf8');
  assert.match(siteConfig, /\/\/ walkthrough:sidebar:begin[\s\S]*\/areas\/x[\s\S]*\/\/ walkthrough:sidebar:end/);
});

test('refresh stamps HEAD and reports the first refresh with no baseline', () => {
  const repo = fixture();
  assert.equal(wt(['init'], repo).status, 0);
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'docs/walkthrough/manifest.json'), 'utf8'));
  const head = git(['rev-parse', 'HEAD'], repo);
  assert.equal(manifest.root.sha, head);
  assert.equal(manifest.root.short, head.slice(0, 10));
  assert.equal(manifest.root.branch, 'main');
  assert.equal(manifest.generator.name, 'walkthrough-skill');
  assert.equal(manifest.previous.rootSha, null);
  assert.deepEqual(manifest.submodules, []);
  assert.match(
    fs.readFileSync(path.join(repo, 'docs/walkthrough/generated/changes.md'), 'utf8'),
    new RegExp(`First refresh at ${head.slice(0, 10)}; no baseline\\.`),
  );
});

test('check goes STALE after a commit and FRESH again after refresh', () => {
  const repo = fixture();
  assert.equal(wt(['init'], repo).status, 0);
  const before = git(['rev-parse', 'HEAD'], repo);

  assert.equal(wt(['check'], repo).status, 0);

  fs.writeFileSync(path.join(repo, 'apps/x/main.ts'), 'export const x = 1\n');
  git(['add', '-A'], repo);
  git(['commit', '-m', 'add x main'], repo);
  const after = git(['rev-parse', 'HEAD'], repo);

  const stale = wt(['check'], repo);
  assert.equal(stale.status, 1);
  assert.match(stale.out, /^STALE \. /m);
  assert.ok(stale.out.includes(`${before.slice(0, 10)} -> ${after.slice(0, 10)}`), stale.out);

  assert.equal(wt(['refresh'], repo).status, 0);
  const fresh = wt(['check'], repo);
  assert.equal(fresh.status, 0);
  assert.equal(fresh.out.trim(), `FRESH ${after.slice(0, 10)}`);

  // the second refresh diffs against the previous stamp
  const changes = fs.readFileSync(path.join(repo, 'docs/walkthrough/generated/changes.md'), 'utf8');
  assert.match(changes, new RegExp(`Range: \`${before.slice(0, 10)}\\.\\.HEAD\``));
  assert.match(changes, /add x main/);
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'docs/walkthrough/manifest.json'), 'utf8'));
  assert.equal(manifest.previous.rootSha, before);
});

test('refresh lists authored citations that no longer resolve', () => {
  const repo = fixture();
  assert.equal(wt(['init'], repo).status, 0);
  const index = path.join(repo, 'docs/walkthrough/index.md');
  fs.appendFileSync(index, '\nSee `apps/nope/file.ts` and `apps/x/package.json` and `docs/adr/0001-x.md:3`.\n');

  const refresh = wt(['refresh'], repo);
  assert.equal(refresh.status, 0, refresh.err);
  assert.match(refresh.out, /drift: 1 unresolved citation\(s\)/);

  const drift = fs.readFileSync(path.join(repo, 'docs/walkthrough/generated/drift.md'), 'utf8');
  assert.match(drift, /docs\/walkthrough\/index\.md/);
  assert.match(drift, /`apps\/nope\/file\.ts` does not exist/);
  assert.ok(!drift.includes('apps/x/package.json'), 'existing path must not be flagged');
  assert.ok(!drift.includes('0001-x.md:3'), 'line suffix must be stripped before testing existence');

  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('`apps/nope/file.ts`', 'the missing file'));
  assert.equal(wt(['refresh'], repo).status, 0);
  assert.match(
    fs.readFileSync(path.join(repo, 'docs/walkthrough/generated/drift.md'), 'utf8'),
    /Clean: every cited path resolves\./,
  );
});

test('build without vitepress installed fails with an install hint', () => {
  const repo = fixture();
  assert.equal(wt(['init'], repo).status, 0);
  const build = wt(['build'], repo);
  assert.equal(build.status, 1);
  assert.match(build.err, /node_modules\/\.bin\/vitepress not found/);
});

test('no command prints usage and exits 2', () => {
  const noArgs = run([SCRIPT], SKILL_DIR);
  assert.equal(noArgs.status, 2);
  assert.match(noArgs.out, /usage: node walkthrough\.mjs <command>/);
  for (const command of ['init', 'refresh', 'check', 'build', 'dev', 'serve']) {
    assert.ok(noArgs.out.includes(`  ${command}`), `usage omits ${command}`);
  }
  assert.equal(run([SCRIPT, '--help'], SKILL_DIR).status, 2);
});

test('templates/ mirrors the inlined template constants', async () => {
  const mod = await import(new URL('./walkthrough.mjs', import.meta.url));
  const pairs = [
    ['templates/config.mts', mod.TPL_CONFIG_MTS],
    ['templates/theme/index.ts', mod.TPL_THEME_INDEX],
    ['templates/theme/Layout.vue', mod.TPL_LAYOUT_VUE],
    ['templates/pages/index.md', mod.TPL_PAGE_INDEX],
    ['templates/pages/guide/reading-order.md', mod.TPL_PAGE_READING_ORDER],
    ['templates/pages/guide/traps.md', mod.TPL_PAGE_TRAPS],
    ['templates/pages/guide/glossary.md', mod.TPL_PAGE_GLOSSARY],
    ['templates/pages/areas/AREA.md', mod.TPL_PAGE_AREA],
  ];
  for (const [rel, constant] of pairs) {
    assert.equal(fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8'), constant, `${rel} drifted from the script`);
  }
});
