import type { ApiRequest, ApiResponse } from '../_lib/http';
import { archiveStatusHandler } from '../_lib/archiveHandlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return archiveStatusHandler(req, res);
}
