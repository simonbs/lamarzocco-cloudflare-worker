import { describe, expect, it, vi } from "vitest"
import { resolveSerialNumber } from "../../src/services/machines"
import type { Env } from "../../src/config/env"
import type { InstallationKeyData } from "../../src/services/types"
import { apiGet } from "../../src/services/api"

vi.mock("../../src/services/api", () => ({
  apiGet: vi.fn()
}))

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    LM_EMAIL: "user@example.com",
    LM_PASSWORD: "password",
    KV: {} as KVNamespace,
    ...overrides
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

describe("resolveSerialNumber", () => {
  it("returns the configured machine id", async () => {
    const env = createEnv({ LM_MACHINE_ID: "SERIAL-1" })
    const key = createKey()

    const result = await resolveSerialNumber(env, key)

    expect(result).toBe("SERIAL-1")
    expect(apiGet).not.toHaveBeenCalled()
  })

  it("selects the single CoffeeMachine", async () => {
    const env = createEnv()
    const key = createKey()

    vi.mocked(apiGet).mockResolvedValueOnce([
      { type: "CoffeeMachine", serialNumber: "SERIAL-2" }
    ])

    const result = await resolveSerialNumber(env, key)

    expect(result).toBe("SERIAL-2")
  })

  it("falls back to the single thing when no CoffeeMachine is tagged", async () => {
    const env = createEnv()
    const key = createKey()

    vi.mocked(apiGet).mockResolvedValueOnce([
      { serialNumber: "SERIAL-3" }
    ])

    const result = await resolveSerialNumber(env, key)

    expect(result).toBe("SERIAL-3")
  })

  it("throws when multiple machines are present", async () => {
    const env = createEnv()
    const key = createKey()

    vi.mocked(apiGet).mockResolvedValueOnce([
      { type: "CoffeeMachine", serialNumber: "SERIAL-1" },
      { type: "CoffeeMachine", serialNumber: "SERIAL-2" }
    ])

    await expect(resolveSerialNumber(env, key)).rejects.toThrow(
      "Multiple machines found. Set LM_MACHINE_ID to the desired serial number."
    )
  })
})
