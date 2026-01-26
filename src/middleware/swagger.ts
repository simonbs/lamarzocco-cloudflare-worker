import type { MiddlewareHandler } from "hono"
import { isSwaggerEnabled } from "../config/env"
import { jsonResponse } from "../utils/http"

export const requireSwaggerEnabled: MiddlewareHandler = async (context, next) => {
  if (!isSwaggerEnabled(context.env)) {
    return jsonResponse(context, 404, { error: "Not found" })
  }

  return next()
}
