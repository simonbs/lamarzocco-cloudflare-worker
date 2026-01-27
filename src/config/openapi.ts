export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "La Marzocco Stats API",
    version: "1.0.0",
    description: "Expose La Marzocco espresso, flush, and backflush stats via a Cloudflare Worker."
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
        required: ["totals", "periodTotals", "recentEspressos", "lastBackflush"],
        properties: {
          totals: {
            type: "object",
            required: ["coffees", "flushes"],
            properties: {
              coffees: { type: ["integer", "null"] },
              flushes: { type: ["integer", "null"] }
            }
          },
          periodTotals: {
            type: "object",
            properties: {
              days7: { $ref: "#/components/schemas/PeriodTotals" },
              days30: { $ref: "#/components/schemas/PeriodTotals" },
              days60: { $ref: "#/components/schemas/PeriodTotals" },
              days90: { $ref: "#/components/schemas/PeriodTotals" },
              days365: { $ref: "#/components/schemas/PeriodTotals" }
            },
            required: ["days7", "days30", "days60", "days90", "days365"]
          },
          recentEspressos: {
            type: "array",
            items: { $ref: "#/components/schemas/RecentEspresso" }
          },
          lastBackflush: {
            type: ["string", "null"],
            format: "date-time"
          },
          notes: {
            type: ["array", "null"],
            items: { type: "string" }
          }
        }
      },
      PeriodTotals: {
        type: "object",
        required: ["coffees", "flushes"],
        properties: {
          coffees: { type: "integer" },
          flushes: { type: "integer" }
        }
      },
      RecentEspresso: {
        type: "object",
        required: ["timestamp", "extractionSeconds", "massGrams"],
        properties: {
          timestamp: { type: "string", format: "date-time" },
          extractionSeconds: { type: ["number", "null"] },
          massGrams: { type: ["number", "null"] }
        }
      },
      StatusResponse: {
        type: "object",
        properties: {
          machineStatus: { type: ["string", "null"] },
          doses: {
            type: ["object", "null"],
            properties: {
              dose1: { type: ["number", "null"] },
              dose2: { type: ["number", "null"] }
            }
          },
          scale: {
            type: ["object", "null"],
            properties: {
              connected: { type: ["boolean", "null"] },
              batteryLevel: { type: ["number", "null"] }
            }
          },
          imageUrl: { type: ["string", "null"] }
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
        summary: "Fetch espresso/flush/backflush stats",
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
    "/status": {
      get: {
        summary: "Fetch machine status widgets",
        responses: {
          "200": {
            description: "Status payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/StatusResponse" }
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
