#!/usr/bin/env node
// tony-apple-qa CLI — delegates to the wavex-os-installer
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const cmd = args[0] || 'init';

const known = ['init', 'doctor', 'audit', 'status', 'login', 'logout', 'reset'];

if (!known.includes(cmd)) {
  console.error(`Unknown command: ${cmd}`);
  console.error(`Usage: tony-apple-qa [${known.join('|')}]`);
  process.exit(1);
}

// Resolve wavex-os-installer bin relative to this package
const installerBin = new URL('../../installer/bin/init.js', import.meta.url);

try {
  execSync(`node "${fileURLToPath(installerBin)}" ${args.join(' ')}`, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status ?? 1);
}
