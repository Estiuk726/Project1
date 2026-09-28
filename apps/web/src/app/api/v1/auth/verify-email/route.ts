import { accountDeps } from '../../../../../server/container';
import { handleVerifyEmail } from '../../../../../server/handlers/auth';

export function POST(request: Request): Promise<Response> {
  return handleVerifyEmail(request, accountDeps());
}
