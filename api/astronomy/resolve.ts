import type { ApiRequest, ApiResponse } from '../_lib/http';
import { resolveTargetHandler } from '../_lib/archiveHandlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return resolveTargetHandler(req, res);
}
