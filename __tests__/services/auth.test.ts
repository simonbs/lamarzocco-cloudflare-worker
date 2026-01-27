import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearTokenCache, getAccessToken } from "../../src/services/auth"
import { ensureClientRegistered } from "../../src/services/installation"
import type { Env } from "../../src/config/env"
import type { InstallationKeyData, TokenData } from "../../src/services/types"

vi.mock("../../src/services/installation", () => ({
  ensureClientRegistered: vi.fn().mockResolvedValue(undefined)
}))

vi.mock("../../src/services/crypto", () => ({
  buildSignedHeaders: vi.fn().mockResolvedValue({ "x-test": "1" })
}))

const NOW = new Date("2024-01-01T00:00:00Z")
const TOKEN_STORAGE_KEY = "tokens"

function createKey(): InstallationKeyData {
  return {
    installationId: "install-1",
    secretB64: "secret",
    privateKeyJwk: {} as JsonWebKey,
    publicKeyB64: "public"
  }
}

function createEnv(kv: KVNamespace, overrides: Partial<Env> = {}): Env {
  return {
    LM_EMAIL: "user@example.com",
    LM_PASSWORD: "password",
    LM_API_BASE: "https://api.test",
    KV: kv,
    ...overrides
  }
}

function createKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial))
  const get = vi.fn(async (key: string, type?: "json") => {
    const value = store.get(key)
    if (value === undefined) {
      return null
    }

    if (type === "json") {
      return JSON.parse(value)
    }

    return value
  })
  const put = vi.fn(async (key: string, value: string) => {
    store.set(key, value)
  })
  const del = vi.fn(async (key: string) => {
    store.delete(key)
  })

  return {
    store,
    get,
    put,
    del,
    kv: {
      get,
      put,
      delete: del
    } as KVNamespace
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

function createTextResponse(text: string, status: number): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error("Unexpected JSON parse")
    },
    text: async () => text
  } as Response
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("getAccessToken", () => {
  it("returns cached access token when still valid", async () => {
    const existing: TokenData = {
      accessToken: "cached-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 60 * 60 * 1000
    }
    const { kv, put } = createKv({ [TOKEN_STORAGE_KEY]: JSON.stringify(existing) })
    const env = createEnv(kv)
    const key = createKey()

    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch

    const token = await getAccessToken(env, key)

    expect(token).toBe("cached-token")
    expect(fetchMock).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(ensureClientRegistered).toHaveBeenCalledTimes(1)
  })

  it("refreshes the token when it is within the refresh window", async () => {
    const existing: TokenData = {
      accessToken: "stale-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 5 * 60 * 1000
    }
    const { kv, store, put } = createKv({
      [TOKEN_STORAGE_KEY]: JSON.stringify(existing)
    })
    const env = createEnv(kv)
    const key = createKey()

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url
      if (url.endsWith("/auth/refreshtoken")) {
        return createJsonResponse({
          accessToken: "refreshed-token",
          refreshToken: "new-refresh-token"
        })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const token = await getAccessToken(env, key)

    expect(token).toBe("refreshed-token")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledTimes(1)

    const stored = JSON.parse(store.get(TOKEN_STORAGE_KEY) ?? "{}") as TokenData
    expect(stored.accessToken).toBe("refreshed-token")
    expect(stored.refreshToken).toBe("new-refresh-token")
    expect(stored.expiresAt).toBeGreaterThan(Date.now())
  })

  it("falls back to sign-in when refresh fails", async () => {
    const existing: TokenData = {
      accessToken: "stale-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 5 * 60 * 1000
    }
    const { kv, store } = createKv({ [TOKEN_STORAGE_KEY]: JSON.stringify(existing) })
    const env = createEnv(kv)
    const key = createKey()

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url
      if (url.endsWith("/auth/refreshtoken")) {
        return createTextResponse("refresh failed", 500)
      }
      if (url.endsWith("/auth/signin")) {
        return createJsonResponse({
          accessToken: "signed-token",
          refreshToken: "signed-refresh-token"
        })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const token = await getAccessToken(env, key)

    expect(token).toBe("signed-token")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    const stored = JSON.parse(store.get(TOKEN_STORAGE_KEY) ?? "{}") as TokenData
    expect(stored.accessToken).toBe("signed-token")
    expect(stored.refreshToken).toBe("signed-refresh-token")
  })

  it("signs in when no cached token exists", async () => {
    const { kv, store } = createKv()
    const env = createEnv(kv)
    const key = createKey()

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url
      if (url.endsWith("/auth/signin")) {
        return createJsonResponse({
          accessToken: "signed-token",
          refreshToken: "signed-refresh-token"
        })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    globalThis.fetch = fetchMock as typeof fetch

    const token = await getAccessToken(env, key)

    expect(token).toBe("signed-token")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const stored = JSON.parse(store.get(TOKEN_STORAGE_KEY) ?? "{}") as TokenData
    expect(stored.accessToken).toBe("signed-token")
    expect(stored.refreshToken).toBe("signed-refresh-token")
  })
})

describe("clearTokenCache", () => {
  it("deletes the stored token", async () => {
    const { kv, del } = createKv({
      [TOKEN_STORAGE_KEY]: JSON.stringify({ accessToken: "token" })
    })
    const env = createEnv(kv)

    await clearTokenCache(env)

    expect(del).toHaveBeenCalledWith(TOKEN_STORAGE_KEY)
  })
})
