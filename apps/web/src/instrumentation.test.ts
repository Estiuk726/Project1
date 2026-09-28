import { afterEach, describe, expect, it, vi } from 'vitest';
import { register } from './instrumentation';

describe('server startup (instrumentation.register)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  class ExitCalled extends Error {}

  // process.exit never returns in a real process; the mock throws to match that.
  function mockExitAndLog() {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new ExitCalled();
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    return { exit, log };
  }

  it('exits with code 1 and names the variable when DATABASE_URL is missing', () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('DATABASE_URL', undefined);
    const { exit, log } = mockExitAndLog();

    expect(register).toThrow(ExitCalled);
    expect(exit).toHaveBeenCalledWith(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL is required'));
  });

  it('does not print the value of an invalid variable', () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('DATABASE_URL', 'mysql://root:hunter2@db.internal/prod');
    const { exit, log } = mockExitAndLog();

    expect(register).toThrow(ExitCalled);
    expect(exit).toHaveBeenCalledWith(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain('hunter2');
  });

  it('starts when the environment is valid', () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('DATABASE_URL', 'postgres://postgres@localhost:5432/flightmates');
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-secret');
    const { exit } = mockExitAndLog();

    register();

    expect(exit).not.toHaveBeenCalled();
  });
});
