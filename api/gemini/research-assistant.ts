import type { ApiRequest, ApiResponse } from '../_lib/http';
import { researchAssistantHandler } from '../_lib/geminiAssistant';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return researchAssistantHandler(req, res);
}
