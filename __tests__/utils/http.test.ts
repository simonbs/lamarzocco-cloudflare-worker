import { describe, expect, it } from "vitest"
import { jsonResponse, withCors } from "../../src/utils/http"
import type { AppContext } from "../../src/utils/http"

function createContext(): AppContext {
  return {
    json: (payload: unknown, status: number) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: new Headers()
      })
  } as AppContext
}

describe("http utils", () => {
  it("adds CORS headers to json responses", () => {
    const context = createContext()
    const response = jsonResponse(context, 200, { ok: true })
    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })

  it("adds CORS headers to existing responses", () => {
    const response = withCors(new Response(null, { status: 204 }))
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })
})
