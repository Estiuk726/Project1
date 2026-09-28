export interface NewUserWithProfile {
  authProviderId: string;
  email: string;
  /** Calendar date, YYYY-MM-DD. */
  dateOfBirth: string;
  displayName: string;
}

export type CreateUserResult =
  { status: 'created'; userId: string } | { status: 'conflict'; on: 'email' | 'auth_provider_id' };

export interface UserAccount {
  id: string;
  emailVerifiedAt: Date | null;
}

export interface UserRepository {
  /** Creates the user and their profile in one transaction. */
  createWithProfile(user: NewUserWithProfile): Promise<CreateUserResult>;
  findByAuthProviderId(authProviderId: string): Promise<UserAccount | null>;
  /** Sets email_verified_at if not already set. Returns null when no user has this id. */
  markEmailVerified(authProviderId: string, at: Date): Promise<UserAccount | null>;
}
