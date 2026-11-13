import type { ApiRequest, ApiResponse } from '../_lib/http';
import { archiveSearchHandler } from '../_lib/archiveHandlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return archiveSearchHandler(req, res);
}
