import { describe, expect, it } from 'vitest';
import { isAdult } from './age';

describe('isAdult', () => {
  it.each([
    ['2008-09-28', '2026-09-28', true, '18th birthday is today'],
    ['2008-09-29', '2026-09-28', false, '18th birthday is tomorrow'],
    ['2008-09-27', '2026-09-28', true, 'turned 18 yesterday'],
    ['2008-10-01', '2026-09-28', false, 'birthday later in the year'],
    ['1990-01-01', '2026-09-28', true, 'well over 18'],
    ['2030-01-01', '2026-09-28', false, 'born in the future'],
  ])('%s on %s → %s (%s)', (dob, today, expected) => {
    expect(isAdult(dob, today)).toBe(expected);
  });

  it('treats 1 March as the 18th birthday of someone born on 29 February (Q7)', () => {
    expect(isAdult('2008-02-29', '2026-02-28')).toBe(false);
    expect(isAdult('2008-02-29', '2026-03-01')).toBe(true);
  });

  it('uses 29 February itself when the 18th year is a leap year', () => {
    expect(isAdult('2012-02-29', '2030-02-28')).toBe(false);
    expect(isAdult('2012-02-29', '2030-03-01')).toBe(true);
    expect(isAdult('2004-02-29', '2022-03-01')).toBe(true);
    expect(isAdult('1996-02-29', '2014-02-28')).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(() => isAdult('28/09/2008', '2026-09-28')).toThrow();
  });
});
