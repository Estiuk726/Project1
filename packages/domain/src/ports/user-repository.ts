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

export type UserStatus = 'active' | 'restricted' | 'suspended' | 'banned';
export type RequestPolicy = 'everyone' | 'verified_only' | 'nobody';

/** What a signed-in user may see about their own account. Never shown to other users. */
export interface AccountView {
  id: string;
  email: string;
  emailVerified: boolean;
  status: UserStatus;
  profile: {
    displayName: string;
    photoKey: string | null;
    homeCountry: string | null;
    bio: string | null;
    languages: string[];
    interests: string[];
    showAge: boolean;
    showUniversity: boolean;
    requestPolicy: RequestPolicy;
  };
}

export interface UserRepository {
  /** Creates the user and their profile in one transaction. */
  createWithProfile(user: NewUserWithProfile): Promise<CreateUserResult>;
  findByAuthProviderId(authProviderId: string): Promise<UserAccount | null>;
  /** Sets email_verified_at if not already set. Returns null when no user has this id. */
  markEmailVerified(authProviderId: string, at: Date): Promise<UserAccount | null>;
  /** The account and profile of a user who has not been deleted, or null. */
  getAccountView(authProviderId: string): Promise<AccountView | null>;
}
