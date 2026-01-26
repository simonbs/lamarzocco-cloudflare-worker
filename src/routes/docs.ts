import type { AppContext } from "../utils/http"
import { openApiDocument } from "../config/openapi"
import { withCors } from "../utils/http"

export function handleOpenApi(context: AppContext): Response {
  const response = context.json(openApiDocument, 200)
  return withCors(response)
}

export function handleSwaggerUi(): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>La Marzocco Stats API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f7f7f7; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      const specUrl = new URL("/openapi.json", window.location.origin).toString()
      window.ui = SwaggerUIBundle({
        url: specUrl,
        dom_id: "#swagger-ui"
      })
    </script>
  </body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  })
}
