import type { ApiRequest, ApiResponse } from '../_lib/http';
import { geminiStatusHandler } from '../_lib/geminiAssistant';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return geminiStatusHandler(req, res);
}
