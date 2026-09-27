import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// PRD Section 15. Every public table gets RLS enabled in a migration (ADR 0002).

export const userStatus = pgEnum('user_status', ['active', 'restricted', 'suspended', 'banned']);

export const userRole = pgEnum('user_role', ['user', 'admin']);

export const requestPolicy = pgEnum('request_policy', ['everyone', 'verified_only', 'nobody']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Kept current by the set_updated_at trigger.
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authProviderId: text('auth_provider_id').notNull(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    // PRD 9.1: private. The 18+ rule is enforced in the domain at signup.
    dateOfBirth: date('date_of_birth').notNull(),
    status: userStatus('status').notNull().default('active'),
    role: userRole('role').notNull().default('user'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Serves: resolving the signed-in user from the auth provider's session.
    uniqueIndex('users_auth_provider_id_key').on(t.authProviderId),
    // Serves: duplicate-signup check. Case-insensitive so A@x.com and a@x.com collide.
    uniqueIndex('users_email_lower_key').on(sql`lower(${t.email})`),
  ],
);

export const userProfiles = pgTable(
  'user_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    photoKey: text('photo_key'),
    // ISO 3166-1 alpha-2. Null until onboarding step 2. FK to countries arrives in S-01.
    homeCountry: char('home_country', { length: 2 }),
    bio: text('bio'),
    // ISO 639-1 codes, e.g. 'bn', 'en'.
    languages: text('languages')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    interests: text('interests')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    showAge: boolean('show_age').notNull().default(false),
    showUniversity: boolean('show_university').notNull().default(false),
    requestPolicy: requestPolicy('request_policy').notNull().default('everyone'),
    ...timestamps,
  },
  (t) => [
    check('user_profiles_display_name_length', sql`char_length(${t.displayName}) between 1 and 50`),
    check('user_profiles_home_country_format', sql`${t.homeCountry} ~ '^[A-Z]{2}$'`),
    check('user_profiles_bio_length', sql`char_length(${t.bio}) <= 300`),
    check('user_profiles_interests_max', sql`cardinality(${t.interests}) <= 5`),
  ],
);
