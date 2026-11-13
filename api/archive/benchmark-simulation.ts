import type { ApiRequest, ApiResponse } from '../_lib/http';
import { benchmarkSimulationHandler } from '../_lib/archiveHandlers';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  return benchmarkSimulationHandler(req, res);
}
