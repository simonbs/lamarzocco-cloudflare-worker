import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ensureClientRegistered, loadInstallationKey } from "../../src/services/installation"
import type { Env } from "../../src/config/env"
import type { InstallationKeyData } from "../../src/services/types"
import { base64ToBytes, bytesToBase64, generateRequestProof, sha256Bytes } from "../../src/services/crypto"

vi.mock("../../src/services/crypto", () => ({
  base64ToBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
  bytesToBase64: vi.fn((bytes: Uint8Array) => `b64-${bytes.length}`),
  deriveSecretBytes: vi.fn(async () => new Uint8Array([9, 9, 9])),
  generateRequestProof: vi.fn(async () => "proof"),
  sha256Bytes: vi.fn(async () => new Uint8Array([4, 5, 6]))
}))

const INSTALLATION_KEY_STORAGE = "installation_key"
const CLIENT_REGISTERED_STORAGE = "client_registered"

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
    if (value === undefined) return null
    return type === "json" ? JSON.parse(value) : value
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

function createKey(): InstallationKeyData {
  return {
    installationId: "install-1",
    secretB64: "secret",
    privateKeyJwk: {} as JsonWebKey,
    publicKeyB64: "public"
  }
}

beforeEach(() => {
  vi.stubGlobal("crypto", {
    randomUUID: () => "uuid",
    subtle: {
      generateKey: vi.fn(async () => ({ privateKey: "private", publicKey: "public" })),
      exportKey: vi.fn(async (format: string) => {
        if (format === "jwk") {
          return { kty: "EC" }
        }
        if (format === "spki") {
          return new Uint8Array([1, 2, 3, 4]).buffer
        }
        throw new Error(`Unexpected format ${format}`)
      })
    }
  })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("loadInstallationKey", () => {
  it("returns cached key and warns when installation id differs", async () => {
    const existing: InstallationKeyData = {
      installationId: "stored",
      secretB64: "secret",
      privateKeyJwk: { kty: "EC" } as JsonWebKey,
      publicKeyB64: "public"
    }
    const { kv, put } = createKv({
      [INSTALLATION_KEY_STORAGE]: JSON.stringify(existing)
    })
    const env = createEnv(kv, { LM_INSTALLATION_ID: "different" })
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await loadInstallationKey(env)

    expect(result).toEqual(existing)
    expect(put).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it("creates and stores a new installation key", async () => {
    const { kv, store, put } = createKv()
    const env = createEnv(kv, { LM_INSTALLATION_ID: "INSTALL-ABC" })

    const result = await loadInstallationKey(env)

    expect(result.installationId).toBe("install-abc")
    expect(result.publicKeyB64).toBe("b64-4")
    expect(result.secretB64).toBe("b64-3")
    expect(put).toHaveBeenCalledTimes(1)

    const stored = JSON.parse(store.get(INSTALLATION_KEY_STORAGE) ?? "{}") as InstallationKeyData
    expect(stored.installationId).toBe("install-abc")
  })
})

describe("ensureClientRegistered", () => {
  it("skips registration when already registered", async () => {
    const { kv } = createKv({ [CLIENT_REGISTERED_STORAGE]: "true" })
    const env = createEnv(kv)
    const key = createKey()

    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch

    await ensureClientRegistered(env, key)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("registers the client and stores the flag", async () => {
    const { kv, put } = createKv()
    const env = createEnv(kv)
    const key = createKey()

    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }))
    globalThis.fetch = fetchMock as typeof fetch

    await ensureClientRegistered(env, key)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledWith(CLIENT_REGISTERED_STORAGE, "true")

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.test/auth/init")
    const headers = options?.headers as Record<string, string>
    expect(headers["X-App-Installation-Id"]).toBe("install-1")
    expect(headers["X-Request-Proof"]).toBe("proof")
    expect(JSON.parse(options?.body as string)).toEqual({ pk: "public" })

    expect(base64ToBytes).toHaveBeenCalled()
    expect(sha256Bytes).toHaveBeenCalled()
    expect(generateRequestProof).toHaveBeenCalled()
    expect(bytesToBase64).toHaveBeenCalled()
  })

  it("throws when registration fails", async () => {
    const { kv } = createKv()
    const env = createEnv(kv)
    const key = createKey()

    const fetchMock = vi.fn(async () => ({ ok: false, status: 400, text: async () => "bad" }))
    globalThis.fetch = fetchMock as typeof fetch

    await expect(ensureClientRegistered(env, key)).rejects.toThrow(
      "Client registration failed: 400 bad"
    )
  })
})
