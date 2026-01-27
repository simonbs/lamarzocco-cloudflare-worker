import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchStatsForMachine } from "../../src/services/stats"
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
    LM_TIMEZONE: "UTC",
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

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2024-01-10T12:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("fetchStatsForMachine", () => {
  it("builds totals, period windows, and recent espressos", async () => {
    const env = createEnv()
    const key = createKey()

    const todayMs = Date.UTC(2024, 0, 10, 12, 0, 0)
    const nineDaysAgoMs = Date.UTC(2024, 0, 1, 12, 0, 0)

    vi.mocked(apiGet)
      .mockResolvedValueOnce({ output: { totalCoffee: 10, totalFlush: 3 } })
      .mockResolvedValueOnce({
        output: {
          coffees: [
            { timestamp: todayMs / 1000, value: 2 },
            { time: nineDaysAgoMs / 1000, value: 3 }
          ],
          flush: [{ ts: todayMs, value: 1 }]
        }
      })
      .mockResolvedValueOnce({
        output: {
          last_coffees: [
            { time: todayMs / 1000, extraction_seconds: 27, dose_value: "18" },
            { timestamp: todayMs - 2 * 86_400_000, extractionSeconds: 25, doseValueNumerator: 20 }
          ]
        }
      })
      .mockResolvedValueOnce({
        widgets: [
          {
            code: "CMBackFlush",
            output: { lastCleaningStartTime: todayMs }
          }
        ]
      })

    const result = await fetchStatsForMachine(env, key, "SERIAL")

    expect(result.totals).toEqual({ coffees: 10, flushes: 3 })
    expect((result.periodTotals as Record<string, { coffees: number; flushes: number }>).days7)
      .toEqual({ coffees: 2, flushes: 1 })
    expect((result.periodTotals as Record<string, { coffees: number; flushes: number }>).days30)
      .toEqual({ coffees: 5, flushes: 1 })

    expect(result.recentEspressos).toHaveLength(2)
    const first = result.recentEspressos[0] as { timestamp: string; massGrams: number | null }
    expect(first.massGrams).toBe(18)
    expect(first.timestamp).toBe(new Date(todayMs).toISOString())
    expect(result.lastBackflush).toBe(new Date(todayMs).toISOString())

    expect(result.notes).toBeUndefined()
  })

  it("adds notes when trend flushes or recent coffees are missing", async () => {
    const env = createEnv()
    const key = createKey()

    vi.mocked(apiGet)
      .mockResolvedValueOnce({ output: { totalCoffee: 1, totalFlush: 0 } })
      .mockResolvedValueOnce({ output: { coffees: [] } })
      .mockResolvedValueOnce({ output: { last_coffees: [] } })
      .mockResolvedValueOnce({
        widgets: [
          {
            code: "CMBackFlush",
            output: { lastCleaningStartTime: Date.UTC(2024, 0, 1, 12, 0, 0) }
          }
        ]
      })

    const result = await fetchStatsForMachine(env, key, "SERIAL")

    expect(result.notes).toBeDefined()
    expect(result.notes).toHaveLength(2)
    const notes = result.notes as string[]
    expect(notes[0]).toContain("Flush trend data not available")
    expect(notes[1]).toContain("Recent espresso list is empty")
  })
})
