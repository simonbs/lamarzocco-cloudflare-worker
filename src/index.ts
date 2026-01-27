import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { Env } from "./config/env"
import { buildOptionsResponse } from "./middleware/cors"
import { requireSwaggerEnabled } from "./middleware/swagger"
import { handleOpenApi, handleSwaggerUi } from "./routes/docs"
import { handleStats } from "./routes/stats"
import { handleStatus } from "./routes/status"
import { errorResponse } from "./utils/http"

const app = new Hono<{ Bindings: Env }>()

app.options("*", () => buildOptionsResponse())

app.get("/stats", (context) => handleStats(context))
app.get("/status", (context) => handleStatus(context))

app.get("/openapi.json", requireSwaggerEnabled, (context) => handleOpenApi(context))
app.get("/docs", requireSwaggerEnabled, () => handleSwaggerUi())

app.onError((error, context) => {
  const status = error instanceof HTTPException ? error.status : 500
  const description =
    error instanceof Error && error.message
      ? error.message
      : status >= 500
        ? "Unexpected error. Please retry later or check server logs for details."
        : "Request failed."
  const errorLabel = status >= 500 ? "Internal Server Error" : "Request failed"
  return errorResponse(context, status, errorLabel, description)
})

app.notFound((context) => errorResponse(context, 404, "Not found", "No route matches this request."))

export default app
