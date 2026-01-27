import { describe, expect, it } from "vitest"
import { applyCorsHeaders, buildOptionsResponse } from "../../src/middleware/cors"

describe("cors middleware", () => {
  it("applies CORS headers", () => {
    const headers = new Headers()
    applyCorsHeaders(headers)
    expect(headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("builds the preflight response", () => {
    const response = buildOptionsResponse()
    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,OPTIONS")
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type")
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400")
  })
})
