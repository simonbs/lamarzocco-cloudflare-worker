import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import type { Env } from "../config/env"
import { applyCorsHeaders } from "../middleware/cors"

export type AppContext = Context<{ Bindings: Env }>

export function jsonResponse(
  context: AppContext,
  status: number,
  payload: Record<string, unknown>
): Response {
  const response = context.json(payload, status as ContentfulStatusCode)
  applyCorsHeaders(response.headers)
  return response
}

export function errorResponse(
  context: AppContext,
  status: number,
  error: string,
  description?: string
): Response {
  const payload: Record<string, unknown> = { error, status }
  if (description) {
    payload.description = description
  }
  return jsonResponse(context, status, payload)
}

export function withCors(response: Response): Response {
  applyCorsHeaders(response.headers)
  return response
}
