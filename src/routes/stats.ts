import type { AppContext } from "../utils/http"
import { jsonResponse } from "../utils/http"
import { fetchStats } from "../services/lamarzocco"

export async function handleStats(context: AppContext): Promise<Response> {
  const stats = await fetchStats(context.env)
  return jsonResponse(context, 200, stats)
}
