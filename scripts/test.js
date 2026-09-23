#!/usr/bin/env node
// Self-contained test entrypoint for `npm test`.
//
// A fresh checkout has no node_modules, and on some hosts a standalone
// (Python) `playwright` binary sits on PATH that rejects the `test`
// subcommand — resolving `playwright` through PATH there exits 1 with
// "error: unknown command 'test'" (NEEDLE fallback gate failure on
// sunsim-97354855, 2026-09-23). This runner bootstraps dependencies from
// the lockfile when missing, then invokes the locally installed
// @playwright/test CLI by explicit path so PATH never decides which
// playwright runs.

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');

if (!existsSync(cli)) {
  console.error('[test] node_modules incomplete — installing from package-lock.json...');
  const install = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {
    stdio: 'inherit',
    cwd: root
  });
  if (install.error) {
    console.error(`[test] npm ci could not start: ${install.error.message}`);
    process.exit(1);
  }
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}

const args = process.argv.slice(2);
const run = spawnSync(process.execPath, [cli, 'test', ...args], {
  stdio: 'inherit',
  cwd: root
});

if (run.error) {
  console.error(`[test] playwright test could not start: ${run.error.message}`);
  process.exit(1);
}
process.exit(run.status ?? 1);
