import type { Env } from "../config/env"
import type { InstallationKeyData } from "./types"
import { apiGet } from "./api"

export async function resolveSerialNumber(env: Env, key: InstallationKeyData): Promise<string> {
  if (env.LM_MACHINE_ID) return env.LM_MACHINE_ID
  const things = await apiGet(env, key, "/things")
  if (!Array.isArray(things)) {
    throw new Error("Unexpected response from /things endpoint.")
  }

  const machines = things.filter(
    (thing) => typeof thing === "object" && thing !== null && (thing as { type?: string }).type === "CoffeeMachine"
  )
  if (machines.length === 1) {
    const serial = (machines[0] as { serialNumber?: string }).serialNumber
    if (serial) return serial
  }

  if (machines.length === 0 && things.length === 1) {
    const serial = (things[0] as { serialNumber?: string }).serialNumber
    if (serial) return serial
  }

  throw new Error("Multiple machines found. Set LM_MACHINE_ID to the desired serial number.")
}
