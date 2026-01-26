import type { Env } from "../config/env"
import { assertRequiredEnv } from "../config/env"
import { loadInstallationKey, ensureClientRegistered } from "./installation"
import { resolveSerialNumber } from "./machines"
import { fetchStatsForMachine } from "./stats"

export async function fetchStats(env: Env): Promise<Record<string, unknown>> {
  assertRequiredEnv(env)

  const installationKey = await loadInstallationKey(env)
  await ensureClientRegistered(env, installationKey)

  const serialNumber = await resolveSerialNumber(env, installationKey)
  return fetchStatsForMachine(env, installationKey, serialNumber)
}
