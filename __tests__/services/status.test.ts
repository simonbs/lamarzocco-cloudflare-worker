import { describe, expect, it, vi } from "vitest"
import { fetchStatus } from "../../src/services/status"
import type { Env } from "../../src/config/env"
import type { InstallationKeyData } from "../../src/services/types"
import { apiGet } from "../../src/services/api"
import { ensureClientRegistered, loadInstallationKey } from "../../src/services/installation"
import { resolveSerialNumber } from "../../src/services/machines"

vi.mock("../../src/services/api", () => ({
  apiGet: vi.fn()
}))

vi.mock("../../src/services/installation", () => ({
  loadInstallationKey: vi.fn(),
  ensureClientRegistered: vi.fn()
}))

vi.mock("../../src/services/machines", () => ({
  resolveSerialNumber: vi.fn()
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

describe("fetchStatus", () => {
  it("extracts widget values and image URL", async () => {
    const env = createEnv()
    const key = createKey()

    vi.mocked(loadInstallationKey).mockResolvedValue(key)
    vi.mocked(ensureClientRegistered).mockResolvedValue(undefined)
    vi.mocked(resolveSerialNumber).mockResolvedValue("SERIAL")
    vi.mocked(apiGet).mockResolvedValue({
      widgets: [
        { code: "CMMachineStatus", output: { status: "READY" } },
        {
          code: "CMBrewByWeightDoses",
          output: { doses: { Dose1: { dose: 18 }, Dose2: { dose: 20 } } }
        },
        { code: "ThingScale", output: { connected: true, batteryLevel: 80 } }
      ],
      coffeeStation: {
        coffeeMachine: {
          imageUrlDetail: "https://example.test/machine.png"
        }
      }
    })

    const result = await fetchStatus(env)

    expect(result.machineStatus).toBe("READY")
    expect(result.doses).toEqual({ dose1: 18, dose2: 20 })
    expect(result.scale).toEqual({ connected: true, batteryLevel: 80 })
    expect(result.imageUrl).toBe("https://example.test/machine.png")
  })
})
