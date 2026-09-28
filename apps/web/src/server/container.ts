import { createSupabaseAuthProvider, noopAnalytics } from '@flightmates/adapters';
import { createDatabase, createUserRepository } from '@flightmates/db';
import { systemClock, type AccountDeps } from '@flightmates/domain';
import { serverEnv } from '../env';

let deps: AccountDeps | undefined;

/** Composition root: wires domain services to real adapters. Server only. */
export function accountDeps(): AccountDeps {
  if (!deps) {
    const env = serverEnv();
    const { db } = createDatabase(env.DATABASE_URL);
    deps = {
      authProvider: createSupabaseAuthProvider({
        url: env.SUPABASE_URL,
        anonKey: env.SUPABASE_ANON_KEY,
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      }),
      users: createUserRepository(db),
      clock: systemClock,
      analytics: noopAnalytics,
    };
  }
  return deps;
}
