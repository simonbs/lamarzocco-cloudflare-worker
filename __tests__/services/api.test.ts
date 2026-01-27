import { afterEach, describe, expect, it, vi } from "vitest"
import { apiGet } from "../../src/services/api"
import type { Env } from "../../src/config/env"
import type { InstallationKeyData } from "../../src/services/types"
import { clearTokenCache, getAccessToken } from "../../src/services/auth"
import { buildSignedHeaders } from "../../src/services/crypto"

vi.mock("../../src/services/auth", () => ({
  getAccessToken: vi.fn(),
  clearTokenCache: vi.fn()
}))

vi.mock("../../src/services/crypto", () => ({
  buildSignedHeaders: vi.fn()
}))

function createEnv(): Env {
  return {
    LM_EMAIL: "user@example.com",
    LM_PASSWORD: "password",
    LM_API_BASE: "https://api.test",
    KV: {} as KVNamespace
  }
}

function createKey(): InstallationKeyData {
  return {
    installationId: "install-1",
    secretB64: "secret",
    privateKeyJwk: {} as JsonWebKey,
    publicKeyB64: "public"
  }
}

function createJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("apiGet", () => {
  it("retries once after 401 and uses a refreshed token", async () => {
    const env = createEnv()
    const key = createKey()

    vi.mocked(getAccessToken)
      .mockResolvedValueOnce("token-1")
      .mockResolvedValueOnce("token-2")
    vi.mocked(buildSignedHeaders)
      .mockResolvedValueOnce({ "x-test": "1" })
      .mockResolvedValueOnce({ "x-test": "2" })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => "unauthorized" })
      .mockResolvedValueOnce(createJsonResponse({ ok: true }))
    globalThis.fetch = fetchMock as typeof fetch

    const result = await apiGet(env, key, "/things")

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(clearTokenCache).toHaveBeenCalledTimes(1)
    expect(getAccessToken).toHaveBeenCalledTimes(2)

    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>
    expect(firstHeaders.Authorization).toBe("Bearer token-1")
    expect(secondHeaders.Authorization).toBe("Bearer token-2")
  })

  it("throws when the request fails without retry", async () => {
    const env = createEnv()
    const key = createKey()

    vi.mocked(getAccessToken).mockResolvedValue("token-1")
    vi.mocked(buildSignedHeaders).mockResolvedValue({ "x-test": "1" })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" })
    globalThis.fetch = fetchMock as typeof fetch

    await expect(apiGet(env, key, "/things")).rejects.toThrow(
      "API request failed (500): boom"
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(clearTokenCache).not.toHaveBeenCalled()
  })
})
