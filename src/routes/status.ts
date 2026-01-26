import type { AppContext } from "../utils/http"
import { jsonResponse } from "../utils/http"
import { fetchStatus } from "../services/status"

export async function handleStatus(context: AppContext): Promise<Response> {
  const status = await fetchStatus(context.env)
  return jsonResponse(context, 200, status)
}
