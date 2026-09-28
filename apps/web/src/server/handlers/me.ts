import { meResponseSchema } from '@flightmates/contracts';
import { signOutOtherDevices } from '@flightmates/domain';
import { handleErrors, type RouteDeps, json, rejectCrossSite } from '../http';
import { withSession } from '../session';

/** GET /api/v1/me: the caller's own account only; there is no user id to ask for. */
export function handleGetMe(request: Request, deps: RouteDeps): Promise<Response> {
  return handleErrors(request, deps, () =>
    withSession(request, deps, (auth) => {
      // Parsing through the contract drops any field not in the documented response.
      const response = json(meResponseSchema.parse(auth.account), 200);
      response.headers.set('cache-control', 'no-store');
      return Promise.resolve(response);
    }),
  );
}

/** POST /api/v1/me/session/revoke-others (PRD 16): log out other devices. */
export function handleRevokeOtherSessions(request: Request, deps: RouteDeps): Promise<Response> {
  return handleErrors(request, deps, async () => {
    const blocked = rejectCrossSite(request);
    if (blocked) return blocked;
    return withSession(request, deps, async (auth) => {
      await signOutOtherDevices(deps, auth);
      return new Response(null, { status: 204 });
    });
  });
}
