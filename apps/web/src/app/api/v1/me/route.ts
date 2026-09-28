import { accountDeps } from '../../../../server/container';
import { handleGetMe } from '../../../../server/handlers/me';

export function GET(request: Request): Promise<Response> {
  return handleGetMe(request, accountDeps());
}
