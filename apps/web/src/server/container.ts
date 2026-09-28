import {
  createJsonLogger,
  createSupabaseAuthProvider,
  noopAnalytics,
  noopErrorTracker,
} from '@flightmates/adapters';
import { createDatabase, createUserRepository } from '@flightmates/db';
import { systemClock } from '@flightmates/domain';
import { serverEnv } from '../env';
import type { RouteDeps } from './http';

let deps: RouteDeps | undefined;

/** Composition root: wires domain services to real adapters. Server only. */
export function accountDeps(): RouteDeps {
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
      logger: createJsonLogger(),
      errorTracker: noopErrorTracker,
    };
  }
  return deps;
}
