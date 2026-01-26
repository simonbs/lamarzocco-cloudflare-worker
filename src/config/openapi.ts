export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "La Marzocco Stats API",
    version: "1.0.0",
    description: "Expose La Marzocco espresso and backflush stats via a Cloudflare Worker."
  },
  servers: [
    {
      url: "/"
    }
  ],
  components: {
    schemas: {
      StatsResponse: {
        type: "object",
        required: ["counts", "last"],
        properties: {
          counts: {
            type: "object",
            required: ["espresso", "backflush"],
            properties: {
              espresso: {
                type: "object",
                required: ["allTime", "year", "month", "week", "today"],
                properties: {
                  allTime: { type: ["integer", "null"] },
                  year: { type: "integer" },
                  month: { type: "integer" },
                  week: { type: "integer" },
                  today: { type: "integer" }
                }
              },
              backflush: {
                type: "object",
                required: ["allTime", "year", "month", "week", "today"],
                properties: {
                  allTime: { type: ["integer", "null"] },
                  year: { type: "integer" },
                  month: { type: "integer" },
                  week: { type: "integer" },
                  today: { type: "integer" }
                }
              }
            }
          },
          last: {
            type: "object",
            required: ["espresso", "backflush"],
            properties: {
              espresso: { type: ["string", "null"], format: "date-time" },
              backflush: { type: ["string", "null"], format: "date-time" }
            }
          },
          notes: {
            type: ["array", "null"],
            items: { type: "string" }
          }
        }
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string" }
        }
      }
    }
  },
  paths: {
    "/stats": {
      get: {
        summary: "Fetch espresso/backflush stats",
        responses: {
          "200": {
            description: "Stats payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatsResponse" }
              }
            }
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/openapi.json": {
      get: {
        summary: "OpenAPI spec",
        responses: {
          "200": {
            description: "OpenAPI document",
            content: {
              "application/json": {
                schema: { type: "object" }
              }
            }
          }
        }
      }
    },
    "/docs": {
      get: {
        summary: "Swagger UI",
        responses: {
          "200": {
            description: "Swagger UI HTML",
            content: {
              "text/html": {
                schema: { type: "string" }
              }
            }
          }
        }
      }
    }
  }
}
