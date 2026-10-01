#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseNextBuildOutput } from './lib/performance-r3-metrics.mjs';

const args = process.argv.slice(2);
const valueOf = (flag, fallback = null) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const inputPath = valueOf('--input');
const outputPath = resolve(valueOf('--output', '.performance-r3/build-metrics.json'));
const logPath = resolve(valueOf('--log', '.performance-r3/next-build.log'));

function currentCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : process.env.GITHUB_SHA ?? null;
}

function nextVersion() {
  try {
    return JSON.parse(readFileSync(resolve('package.json'), 'utf8')).dependencies?.next ?? null;
  } catch {
    return null;
  }
}

function writeReport(rawLog, buildExitCode, source) {
  const parsed = parseNextBuildOutput(rawLog);
  const report = {
    schemaVersion: 1,
    reportType: 'performance-r3-next-build',
    generatedAt: new Date().toISOString(),
    gitCommit: currentCommit(),
    nextVersion: nextVersion(),
    source,
    buildExitCode,
    bundle: parsed,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PERF-R3 build metrics: ${outputPath}`);
  console.log(`Routes parsed: ${Object.keys(parsed.routes).length}`);
  console.log(`Shared First Load JS: ${parsed.sharedFirstLoadJsKb ?? 'not found'} kB`);
  return report;
}

if (inputPath) {
  const rawLog = readFileSync(resolve(inputPath), 'utf8');
  const report = writeReport(rawLog, null, 'saved-build-log');
  if (!Object.keys(report.bundle.routes).length) process.exitCode = 2;
} else {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build'], {
        env,
        stdio: ['inherit', 'pipe', 'pipe'],
      })
    : spawn('npm', ['run', 'build'], {
        env,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
  let rawLog = '';
  child.stdout.on('data', (chunk) => { rawLog += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', (chunk) => { rawLog += chunk; process.stderr.write(chunk); });
  child.on('close', (code) => {
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, rawLog);
    const report = writeReport(rawLog, code ?? 1, 'npm-run-build');
    if ((code ?? 1) !== 0 || !Object.keys(report.bundle.routes).length) process.exitCode = code || 2;
  });
}
