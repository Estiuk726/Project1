import { accountDeps } from '../../../../../../server/container';
import { handleRevokeOtherSessions } from '../../../../../../server/handlers/me';

export function POST(request: Request): Promise<Response> {
  return handleRevokeOtherSessions(request, accountDeps());
}
