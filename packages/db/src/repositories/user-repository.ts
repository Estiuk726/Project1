import type { CreateUserResult, UserAccount, UserRepository } from '@flightmates/domain';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { userProfiles, users } from '../schema';

const UNIQUE_VIOLATION = '23505';

/** Finds the Postgres error in a driver error or its cause (Drizzle wraps driver errors). */
function uniqueViolationConstraint(error: unknown): string | undefined {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    const pg = current as Error & { code?: unknown; constraint_name?: unknown };
    if (pg.code === UNIQUE_VIOLATION && typeof pg.constraint_name === 'string') {
      return pg.constraint_name;
    }
  }
  return undefined;
}

export function createUserRepository(db: Database): UserRepository {
  return {
    async createWithProfile(user): Promise<CreateUserResult> {
      try {
        const userId = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(users)
            .values({
              authProviderId: user.authProviderId,
              email: user.email,
              dateOfBirth: user.dateOfBirth,
            })
            .returning({ id: users.id });
          if (!row) throw new Error('Insert into users returned no row');
          await tx.insert(userProfiles).values({ userId: row.id, displayName: user.displayName });
          return row.id;
        });
        return { status: 'created', userId };
      } catch (error) {
        const constraint = uniqueViolationConstraint(error);
        if (constraint === 'users_email_lower_key') return { status: 'conflict', on: 'email' };
        if (constraint === 'users_auth_provider_id_key') {
          return { status: 'conflict', on: 'auth_provider_id' };
        }
        throw error;
      }
    },

    async findByAuthProviderId(authProviderId): Promise<UserAccount | null> {
      const [row] = await db
        .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.authProviderId, authProviderId));
      return row ?? null;
    },

    async markEmailVerified(authProviderId, at): Promise<UserAccount | null> {
      const [row] = await db
        .update(users)
        .set({
          emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, ${at.toISOString()}::timestamptz)`,
        })
        .where(eq(users.authProviderId, authProviderId))
        .returning({ id: users.id, emailVerifiedAt: users.emailVerifiedAt });
      return row ?? null;
    },
  };
}
