import { accountDeps } from '../../../../../server/container';
import { handleResendCode } from '../../../../../server/handlers/auth';

export function POST(request: Request): Promise<Response> {
  return handleResendCode(request, accountDeps());
}
