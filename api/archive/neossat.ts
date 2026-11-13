import type { ApiRequest, ApiResponse } from '../_lib/http';
import { neossatArchiveHandler } from '../_lib/neossatHandlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return neossatArchiveHandler(req, res);
}
