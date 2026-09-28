import { accountDeps } from '../../../../../server/container';
import { handleSignup } from '../../../../../server/handlers/auth';

export function POST(request: Request): Promise<Response> {
  return handleSignup(request, accountDeps());
}
