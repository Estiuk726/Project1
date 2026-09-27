import { parseServerEnv, type ServerEnv } from '@flightmates/config/env';

let cached: ServerEnv | undefined;

/** Validated server environment. Server code only; never import from client components. */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
