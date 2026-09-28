export interface Clock {
  now(): Date;
  /** Today's calendar date in UTC, YYYY-MM-DD. */
  today(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  today: () => new Date().toISOString().slice(0, 10),
};
