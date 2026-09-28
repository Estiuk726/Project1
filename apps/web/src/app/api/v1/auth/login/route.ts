import { accountDeps } from '../../../../../server/container';
import { handleLogin } from '../../../../../server/handlers/auth';

export function POST(request: Request): Promise<Response> {
  return handleLogin(request, accountDeps());
}
