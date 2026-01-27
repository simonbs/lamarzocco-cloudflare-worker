import type { Env } from "../config/env"
import { getLastCoffeeDays, getTimezone } from "../config/env"
import type { InstallationKeyData, TrendEvent } from "./types"
import { apiGet } from "./api"
import { createDatePartsExtractor, dateOrdinal } from "./dates"

const PERIOD_WINDOWS = [7, 30, 60, 90, 365]
const DAY_MS = 86_400_000
const HOURS_24_MS = 24 * 60 * 60 * 1000
const BACKFLUSH_WIDGET_CODE = "CMBackFlush"

export async function fetchStatsForMachine(
  env: Env,
  key: InstallationKeyData,
  serialNumber: string
): Promise<Record<string, unknown>> {
  const timezone = getTimezone(env)
  const lastCoffeeDays = Math.max(getLastCoffeeDays(env), 15)
  const trendDays = 365

  const [counterRaw, trendRaw, lastCoffeeRaw, dashboardRaw] = await Promise.all([
    apiGet(env, key, `/things/${serialNumber}/stats/COFFEE_AND_FLUSH_COUNTER/1`),
    apiGet(
      env,
      key,
      `/things/${serialNumber}/stats/COFFEE_AND_FLUSH_TREND/1?days=${trendDays}&timezone=${encodeURIComponent(
        timezone
      )}`
    ),
    apiGet(env, key, `/things/${serialNumber}/stats/LAST_COFFEE/1?days=${lastCoffeeDays}`),
    apiGet(env, key, `/things/${serialNumber}/dashboard`)
  ])

  const counterOutput = (counterRaw as { output?: Record<string, unknown> }).output ?? counterRaw
  const trendOutput = (trendRaw as { output?: Record<string, unknown> }).output ?? trendRaw
  const lastCoffeeOutput = (lastCoffeeRaw as { output?: Record<string, unknown> }).output ?? lastCoffeeRaw
  const dashboardOutput = (dashboardRaw as { output?: Record<string, unknown> }).output ?? dashboardRaw

  const coffeeTotal = numberOrNull((counterOutput as Record<string, unknown>).totalCoffee)
  const flushTotal = numberOrNull((counterOutput as Record<string, unknown>).totalFlush)

  const { coffees, flushes } = extractTrendEvents(trendOutput)
  const dateParts = createDatePartsExtractor(timezone)
  const now = new Date()
  const nowParts = dateParts(now)
  const periodTotals = buildPeriodTotals(coffees, flushes, nowParts, now.getTime(), dateParts)

  const recentEspressos = extractRecentEspressos(lastCoffeeOutput, 15)
  const backflushWidget = findWidgetOutput(dashboardOutput, BACKFLUSH_WIDGET_CODE)
  const lastBackflush = extractLastBackflush(backflushWidget)

  const notes: string[] = []
  if (flushes.length === 0) {
    notes.push("Flush trend data not available from API response; period totals for flushes may be zero.")
  }
  if (recentEspressos.length === 0) {
    notes.push("Recent espresso list is empty; ensure the API provides last coffee data.")
  }
  if (!backflushWidget) {
    notes.push("Backflush widget not available in the dashboard response; ensure CMBackFlush is enabled.")
  } else if (!lastBackflush) {
    notes.push("Backflush widget present but lastCleaningStartTime is missing.")
  }

  return {
    totals: {
      coffees: coffeeTotal,
      flushes: flushTotal
    },
    periodTotals,
    recentEspressos,
    lastBackflush,
    notes: notes.length > 0 ? notes : undefined
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseTimestampMs(value: unknown): number | null {
  const numeric = parseNumber(value)
  if (numeric !== null) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function findWidgetOutput(payload: unknown, code: string): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  const widgets = record.widgets ?? record.selectedWidgets
  if (!Array.isArray(widgets)) return null
  for (const widget of widgets) {
    if (!widget || typeof widget !== "object") continue
    const widgetRecord = widget as Record<string, unknown>
    if (widgetRecord.code !== code) continue
    const output = widgetRecord.output
    if (!output || typeof output !== "object") return null
    return output as Record<string, unknown>
  }
  return null
}

function extractTrendEvents(output: unknown): { coffees: TrendEvent[]; flushes: TrendEvent[] } {
  if (!output || typeof output !== "object") {
    return { coffees: [], flushes: [] }
  }
  const record = output as Record<string, unknown>
  const coffees = normalizeTrendArray(record.coffees)
  const flushes = normalizeTrendArray(record.flushes ?? record.flush ?? record.flushing)
  return { coffees, flushes }
}

function normalizeTrendArray(raw: unknown): TrendEvent[] {
  if (!Array.isArray(raw)) return []
  const events: TrendEvent[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    let timestamp = numberOrNull(record.timestamp) ?? numberOrNull(record.time) ?? numberOrNull(record.ts)
    if (timestamp === null) continue
    if (timestamp < 1_000_000_000_000) {
      timestamp *= 1000
    }
    const value = numberOrNull(record.value) ?? 0
    events.push({ timestampMs: timestamp, value })
  }
  return events
}

function buildPeriodTotals(
  coffees: TrendEvent[],
  flushes: TrendEvent[],
  nowParts: { year: number; month: number; day: number },
  nowMs: number,
  dateParts: (date: Date) => { year: number; month: number; day: number }
): Record<string, { coffees: number; flushes: number }> {
  const totals: Record<string, { coffees: number; flushes: number }> = {}
  totals.hours24 = {
    coffees: sumEventsWithinMs(coffees, nowMs - HOURS_24_MS, nowMs),
    flushes: sumEventsWithinMs(flushes, nowMs - HOURS_24_MS, nowMs)
  }
  for (const days of PERIOD_WINDOWS) {
    totals[`days${days}`] = {
      coffees: sumEventsWithinDays(coffees, nowParts, dateParts, days),
      flushes: sumEventsWithinDays(flushes, nowParts, dateParts, days)
    }
  }
  return totals
}

function sumEventsWithinMs(events: TrendEvent[], startMs: number, endMs: number): number {
  if (events.length === 0) return 0
  let total = 0
  for (const event of events) {
    if (event.timestampMs >= startMs && event.timestampMs <= endMs) {
      total += event.value
    }
  }
  return total
}

function sumEventsWithinDays(
  events: TrendEvent[],
  nowParts: { year: number; month: number; day: number },
  dateParts: (date: Date) => { year: number; month: number; day: number },
  days: number
): number {
  if (events.length === 0) return 0
  const todayOrdinal = dateOrdinal(nowParts)
  const cutoff = todayOrdinal - (days - 1) * DAY_MS
  let total = 0
  for (const event of events) {
    const parts = dateParts(new Date(event.timestampMs))
    const ordinal = dateOrdinal(parts)
    if (ordinal >= cutoff && ordinal <= todayOrdinal) {
      total += event.value
    }
  }
  return total
}

interface RecentEspresso {
  timestamp: string
  extractionSeconds: number | null
  massGrams: number | null
}

function extractRecentEspressos(output: unknown, limit: number): RecentEspresso[] {
  if (!output || typeof output !== "object") return []
  const record = output as Record<string, unknown>
  const list = record.lastCoffees ?? record.last_coffees
  if (!Array.isArray(list)) return []

  const mapped = list
    .map((item): RecentEspresso | null => {
      if (!item || typeof item !== "object") return null
      const coffee = item as Record<string, unknown>
      let timestamp = numberOrNull(coffee.time) ?? numberOrNull(coffee.timestamp)
      if (timestamp === null) return null
      if (timestamp < 1_000_000_000_000) {
        timestamp *= 1000
      }
      const extractionSeconds = numberOrNull(coffee.extractionSeconds) ?? numberOrNull(coffee.extraction_seconds)
      const doseValue = parsePositiveNumber(coffee.doseValue ?? coffee.dose_value)
      const massGrams =
        doseValue ??
        parsePositiveNumber(coffee.doseValueNumerator ?? coffee.dose_value_numerator)
      return {
        timestamp: new Date(timestamp).toISOString(),
        extractionSeconds,
        massGrams
      }
    })
    .filter(isRecentEspresso)

  mapped.sort((a, b) => {
    const aTime = Date.parse(a.timestamp)
    const bTime = Date.parse(b.timestamp)
    return bTime - aTime
  })

  return mapped.slice(0, limit)
}

function extractLastBackflush(widget: Record<string, unknown> | null): string | null {
  if (!widget) return null
  const timestampValue =
    widget.lastCleaningStartTime ??
    widget.lastCleaningStart ??
    widget.lastCleaningStartTimeMs ??
    widget.last_cleaning_start_time
  const timestampMs = parseTimestampMs(timestampValue)
  if (timestampMs === null) return null
  return new Date(timestampMs).toISOString()
}

function isRecentEspresso(value: RecentEspresso | null): value is RecentEspresso {
  return value !== null
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseNumber(value)
  if (parsed === null || parsed <= 0) {
    return null
  }
  return parsed
}
