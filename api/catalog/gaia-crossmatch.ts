import type { ApiRequest, ApiResponse } from '../_lib/http';
import { gaiaCrossMatchHandler } from '../_lib/gaiaHandlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return gaiaCrossMatchHandler(req, res);
}
