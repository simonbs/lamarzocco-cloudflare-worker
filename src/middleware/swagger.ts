import type { MiddlewareHandler } from "hono"
import { isSwaggerEnabled } from "../config/env"
import { errorResponse } from "../utils/http"

export const requireSwaggerEnabled: MiddlewareHandler = async (context, next) => {
  if (!isSwaggerEnabled(context.env)) {
    return errorResponse(context, 404, "Not found", "Swagger endpoints are disabled.")
  }

  return next()
}
