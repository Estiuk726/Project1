export const MINIMUM_AGE = 18;

function parseDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Expected a YYYY-MM-DD date');
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * True when someone born on `dateOfBirth` is at least 18 on `today` (both YYYY-MM-DD).
 * Someone born on 29 February turns 18 on 1 March in non-leap years (open question Q7).
 */
export function isAdult(dateOfBirth: string, today: string): boolean {
  const [birthYear, birthMonth, birthDay] = parseDate(dateOfBirth);
  const [year, month, day] = parseDate(today);

  let comingOfAge: [number, number, number] = [birthYear + MINIMUM_AGE, birthMonth, birthDay];
  if (birthMonth === 2 && birthDay === 29 && !isLeapYear(birthYear + MINIMUM_AGE)) {
    comingOfAge = [birthYear + MINIMUM_AGE, 3, 1];
  }

  const [adultYear, adultMonth, adultDay] = comingOfAge;
  if (year !== adultYear) return year > adultYear;
  if (month !== adultMonth) return month > adultMonth;
  return day >= adultDay;
}
