import { z } from 'zod';

/** PRD 16: every error response uses this shape. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Field-level validation problems. Paths and rule names only, never submitted values. */
export interface FieldProblem {
  path: string;
  problem: string;
}
