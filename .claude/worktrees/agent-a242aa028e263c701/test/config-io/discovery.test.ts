import { describe, expect, it } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { readGlobalDefaults, resolveGlobalDefaultsPath } from '../../packages/config-io/src/discovery.js';

describe('resolveGlobalDefaultsPath', () => {
  it('with GSD_HOME set, returns <GSD_HOME>/.gsd/defaults.json', () => {
    const result = resolveGlobalDefaultsPath({ GSD_HOME: 'test/fixtures' } as NodeJS.ProcessEnv);
    expect(result).toBe(path.join('test/fixtures', '.gsd', 'defaults.json'));
  });

  it('with GSD_HOME unset, falls back to <os.homedir()>/.gsd/defaults.json', () => {
    const result = resolveGlobalDefaultsPath({} as NodeJS.ProcessEnv);
    expect(result).toBe(path.join(os.homedir(), '.gsd', 'defaults.json'));
  });

  it('resolved path ends with the platform-joined .gsd/defaults.json', () => {
    const withHome = resolveGlobalDefaultsPath({ GSD_HOME: path.join('some', 'fake', 'home') } as NodeJS.ProcessEnv);
    const withoutHome = resolveGlobalDefaultsPath({} as NodeJS.ProcessEnv);
    const suffix = path.join('.gsd', 'defaults.json');
    expect(withHome.endsWith(suffix)).toBe(true);
    expect(withoutHome.endsWith(suffix)).toBe(true);
  });
});

describe('readGlobalDefaults', () => {
  it('returns { found: true, data } for an existing JSON file', () => {
    const fixturePath = path.resolve('test/fixtures/global-defaults.json');
    const result = readGlobalDefaults(fixturePath);
    expect(result.found).toBe(true);
    expect(result.data).not.toBeNull();
    expect(typeof result.data).toBe('object');
  });

  it('returns { found: false, data: null } for an absent file, without throwing', () => {
    const missingPath = path.resolve('test/fixtures/does-not-exist-defaults.json');
    expect(() => readGlobalDefaults(missingPath)).not.toThrow();
    expect(readGlobalDefaults(missingPath)).toEqual({ found: false, data: null });
  });
});
