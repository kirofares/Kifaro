import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const cliRequire = createRequire(require.resolve('@capacitor/cli/package.json'));
const { rimraf } = cliRequire('rimraf');
const xcode = cliRequire('xcode');

test('Capacitor generates and syncs both native projects; Xcode IDs survive a project round trip', { timeout: 120_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'kifaro-toolchain-'));
  try {
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'junction');
    writeFileSync(join(dir, 'package.json'), readFileSync(join(root, 'package.json')));
    writeFileSync(join(dir, 'capacitor.config.json'), JSON.stringify({
      appId: 'com.kifaro.toolchaintest', appName: 'ToolchainTest', webDir: 'dist',
    }));
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist/index.html'), '<!doctype html><title>Toolchain fixture</title>');
    const cli = join(dirname(require.resolve('@capacitor/cli/package.json')), 'bin/capacitor');
    for (const platform of ['android', 'ios']) {
      for (const command of ['add', 'sync']) {
        execFileSync(process.execPath, [cli, command, platform], {
          cwd: dir, encoding: 'utf8', timeout: 45_000,
          env: { ...process.env, CI: 'true', CAPACITOR_TELEMETRY_DISABLED: '1' },
        });
      }
    }
    assert.match(readFileSync(join(dir, 'android/app/src/main/assets/public/index.html'), 'utf8'), /Toolchain fixture/);
    assert.match(readFileSync(join(dir, 'ios/App/App/public/index.html'), 'utf8'), /Toolchain fixture/);
    const projectPath = join(dir, 'ios/App/App.xcodeproj/project.pbxproj');
    const project = xcode.project(projectPath);
    project.parseSync();
    const targetId = project.getFirstTarget().uuid;
    const group = project.addPbxGroup([], 'CompatibilityFixture', 'CompatibilityFixture');
    assert.match(group.uuid, /^[A-F0-9]{24}$/);
    const ids = new Set(Array.from({ length: 1000 }, () => project.generateUuid()));
    assert.equal(ids.size, 1000);
    for (const id of ids) assert.match(id, /^[A-F0-9]{24}$/);
    writeFileSync(projectPath, project.writeSync());
    const reread = xcode.project(projectPath);
    reread.parseSync();
    assert.equal(reread.getFirstTarget().uuid, targetId);
    assert.ok(reread.hash.project.objects.PBXGroup[group.uuid]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rimraf supports literal cleanup and glob cleanup while preserving unmatched files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kifaro-rimraf-'));
  try {
    for (const name of ['remove.tmp', 'keep.txt']) writeFileSync(join(dir, name), name);
    mkdirSync(join(dir, 'archive'));
    writeFileSync(join(dir, 'archive/contents.txt'), 'fixture');
    assert.equal(rimraf.sync(join(dir, 'archive')), true);
    assert.equal(existsSync(join(dir, 'archive')), false);
    assert.equal(await rimraf(join(dir, '*.tmp'), { glob: true }), true);
    assert.equal(existsSync(join(dir, 'remove.tmp')), false);
    assert.equal(readFileSync(join(dir, 'keep.txt'), 'utf8'), 'keep.txt');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
