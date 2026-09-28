import { describe, expect, it } from 'vitest';
import { resendCodeRequestSchema, signupRequestSchema, verifyEmailRequestSchema } from './auth';

const valid = {
  firstName: '  Tahmid ',
  email: ' Tahmid@Example.COM ',
  password: 'correct horse battery',
  dateOfBirth: '2002-03-12',
};

describe('signupRequestSchema', () => {
  it('trims the name and normalizes the email', () => {
    expect(signupRequestSchema.parse(valid)).toEqual({
      ...valid,
      firstName: 'Tahmid',
      email: 'tahmid@example.com',
    });
  });

  it.each([
    ['firstName', { firstName: '   ' }],
    ['firstName', { firstName: 'x'.repeat(51) }],
    ['email', { email: 'not-an-email' }],
    ['password', { password: 'short' }],
    ['password', { password: 'x'.repeat(73) }],
    ['dateOfBirth', { dateOfBirth: '12/03/2002' }],
    ['dateOfBirth', { dateOfBirth: '2002-02-30' }],
    ['dateOfBirth', { dateOfBirth: '1899-12-31' }],
  ])('rejects an invalid %s', (field, overrides) => {
    const result = signupRequestSchema.safeParse({ ...valid, ...overrides });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain(field);
  });

  it('rejects missing fields', () => {
    expect(signupRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('verifyEmailRequestSchema', () => {
  it.each(['12345', '1234567', 'abcdef', '12 456'])('rejects code %s', (code) => {
    expect(verifyEmailRequestSchema.safeParse({ email: 'a@b.co', code }).success).toBe(false);
  });

  it('accepts a 6-digit code', () => {
    expect(verifyEmailRequestSchema.parse({ email: 'A@b.co', code: '012345' })).toEqual({
      email: 'a@b.co',
      code: '012345',
    });
  });
});

describe('resendCodeRequestSchema', () => {
  it('requires a valid email', () => {
    expect(resendCodeRequestSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});
