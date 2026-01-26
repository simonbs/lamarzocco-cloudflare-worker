import type { Env } from "../config/env"
import { assertRequiredEnv } from "../config/env"
import { apiGet } from "./api"
import { ensureClientRegistered, loadInstallationKey } from "./installation"
import { resolveSerialNumber } from "./machines"

const WIDGET_CODES = {
  machineStatus: "CMMachineStatus",
  brewByWeightDoses: "CMBrewByWeightDoses",
  scale: "ThingScale"
} as const

export async function fetchStatus(env: Env): Promise<Record<string, unknown>> {
  assertRequiredEnv(env)

  const installationKey = await loadInstallationKey(env)
  await ensureClientRegistered(env, installationKey)

  const serialNumber = await resolveSerialNumber(env, installationKey)
  const dashboard = await apiGet(env, installationKey, `/things/${serialNumber}/dashboard`)

  const widgetMap = buildWidgetMap(dashboard)

  const machineStatus = stringOrNull(widgetMap.get(WIDGET_CODES.machineStatus)?.status)
  const doses = extractDoses(widgetMap.get(WIDGET_CODES.brewByWeightDoses))
  const scaleOutput = widgetMap.get(WIDGET_CODES.scale)
  const scale = scaleOutput
    ? {
        connected: booleanOrNull(scaleOutput.connected),
        batteryLevel: numberOrNull(scaleOutput.batteryLevel)
      }
    : null

  return {
    machineStatus,
    doses,
    scale,
    imageUrl: extractImageUrl(dashboard)
  }
}

function buildWidgetMap(dashboard: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  if (!dashboard || typeof dashboard !== "object") return map

  const record = dashboard as Record<string, unknown>
  const widgets = record.widgets ?? record.selectedWidgets
  if (!Array.isArray(widgets)) return map

  for (const widget of widgets) {
    if (!widget || typeof widget !== "object") continue
    const widgetRecord = widget as Record<string, unknown>
    const code = typeof widgetRecord.code === "string" ? widgetRecord.code : null
    const output = widgetRecord.output
    if (!code || !output || typeof output !== "object") continue
    map.set(code, output as Record<string, unknown>)
  }

  return map
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function extractDoses(output: Record<string, unknown> | undefined): { dose1: number | null; dose2: number | null } | null {
  if (!output) return null
  const doses = output.doses ?? output.dose ?? output.doseSettings
  if (!doses || typeof doses !== "object") return null
  const record = doses as Record<string, unknown>
  const dose1 = parseDoseValue(record.Dose1 ?? record.dose1 ?? record.dose_1)
  const dose2 = parseDoseValue(record.Dose2 ?? record.dose2 ?? record.dose_2)
  return { dose1, dose2 }
}

function parseDoseValue(value: unknown): number | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  return numberOrNull(record.dose)
}

function extractImageUrl(dashboard: unknown): string | null {
  if (!dashboard || typeof dashboard !== "object") return null
  const record = dashboard as Record<string, unknown>
  const coffeeStation = record.coffeeStation
  if (!coffeeStation || typeof coffeeStation !== "object") return null
  const station = coffeeStation as Record<string, unknown>
  const machine = station.coffeeMachine
  if (!machine || typeof machine !== "object") return null
  const machineRecord = machine as Record<string, unknown>
  const value = machineRecord.imageUrlDetail
  return typeof value === "string" ? value : null
}
