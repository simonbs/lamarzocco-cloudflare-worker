import { Hono } from "hono"
import type { Env } from "./config/env"
import { buildOptionsResponse } from "./middleware/cors"
import { requireSwaggerEnabled } from "./middleware/swagger"
import { handleOpenApi, handleSwaggerUi } from "./routes/docs"
import { handleStats } from "./routes/stats"
import { jsonResponse } from "./utils/http"

const app = new Hono<{ Bindings: Env }>()

app.options("*", () => buildOptionsResponse())

app.get("/stats", (context) => handleStats(context))

app.get("/openapi.json", requireSwaggerEnabled, (context) => handleOpenApi(context))
app.get("/docs", requireSwaggerEnabled, () => handleSwaggerUi())

app.notFound((context) => jsonResponse(context, 404, { error: "Not found" }))

export default app
