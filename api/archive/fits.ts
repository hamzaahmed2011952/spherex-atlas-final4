import type { ApiRequest, ApiResponse } from '../_lib/http';
import { fitsProxyHandler } from '../_lib/archiveHandlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return fitsProxyHandler(req, res);
}
