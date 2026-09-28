import { accountDeps } from '../../../../../server/container';
import { handleLogout } from '../../../../../server/handlers/auth';

export function POST(request: Request): Promise<Response> {
  return handleLogout(request, accountDeps());
}
