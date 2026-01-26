import type { Env } from "../config/env"
import { getLastCoffeeDays, getTimezone, getWeekStart } from "../config/env"
import type { InstallationKeyData, TrendEvent } from "./types"
import { apiGet } from "./api"
import {
  createDatePartsExtractor,
  dateOrdinal,
  daysSinceYearStart,
  getWeekStart as resolveWeekStart
} from "./dates"

export async function fetchStatsForMachine(
  env: Env,
  key: InstallationKeyData,
  serialNumber: string
): Promise<Record<string, unknown>> {
  const timezone = getTimezone(env)
  const weekStart = getWeekStart(env)

  const now = new Date()
  const dateParts = createDatePartsExtractor(timezone)
  const nowParts = dateParts(now)
  const daysInYearSoFar = daysSinceYearStart(nowParts)
  const trendDays = Math.max(7, daysInYearSoFar)
  const lastCoffeeDays = getLastCoffeeDays(env)

  const [counterRaw, trendRaw, lastCoffeeRaw] = await Promise.all([
    apiGet(env, key, `/things/${serialNumber}/stats/COFFEE_AND_FLUSH_COUNTER/1`),
    apiGet(
      env,
      key,
      `/things/${serialNumber}/stats/COFFEE_AND_FLUSH_TREND/1?days=${trendDays}&timezone=${encodeURIComponent(
        timezone
      )}`
    ),
    apiGet(env, key, `/things/${serialNumber}/stats/LAST_COFFEE/1?days=${lastCoffeeDays}`)
  ])

  const counterOutput = (counterRaw as { output?: Record<string, unknown> }).output ?? counterRaw
  const trendOutput = (trendRaw as { output?: Record<string, unknown> }).output ?? trendRaw
  const lastCoffeeOutput = (lastCoffeeRaw as { output?: Record<string, unknown> }).output ?? lastCoffeeRaw

  const coffeeTotal = numberOrNull((counterOutput as Record<string, unknown>).totalCoffee)
  const flushTotal = numberOrNull((counterOutput as Record<string, unknown>).totalFlush)

  const { coffees, flushes } = extractTrendEvents(trendOutput)
  const coffeeCounts = computeCounts(coffees, nowParts, weekStart, dateParts)
  const flushCounts = computeCounts(flushes, nowParts, weekStart, dateParts)

  const lastCoffee = latestTimestampFromLastCoffee(lastCoffeeOutput)
  const lastCoffeeFallback = latestTimestampFromEvents(coffees)
  const lastFlush = latestTimestampFromEvents(flushes)

  const notes: string[] = []
  if (flushes.length === 0) {
    notes.push("Flush trend data not available from API response; backflush time/range counts may be missing.")
  }
  if (lastCoffee === null && lastCoffeeFallback !== null) {
    notes.push("Last espresso derived from trend data because last coffee list was empty.")
  }

  return {
    counts: {
      espresso: {
        allTime: coffeeTotal,
        year: coffeeCounts.year,
        month: coffeeCounts.month,
        week: coffeeCounts.week,
        today: coffeeCounts.today
      },
      backflush: {
        allTime: flushTotal,
        year: flushCounts.year,
        month: flushCounts.month,
        week: flushCounts.week,
        today: flushCounts.today
      }
    },
    last: {
      espresso: toIsoOrNull(lastCoffee ?? lastCoffeeFallback),
      backflush: toIsoOrNull(lastFlush)
    },
    notes: notes.length > 0 ? notes : undefined
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function toIsoOrNull(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString()
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

function latestTimestampFromEvents(events: TrendEvent[]): number | null {
  let max = -Infinity
  for (const event of events) {
    if (event.timestampMs > max) max = event.timestampMs
  }
  return max === -Infinity ? null : max
}

function latestTimestampFromLastCoffee(output: unknown): number | null {
  if (!output || typeof output !== "object") return null
  const record = output as Record<string, unknown>
  const list = record.lastCoffees ?? record.last_coffees
  if (!Array.isArray(list)) return null
  let max = -Infinity
  for (const item of list) {
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    let timestamp = numberOrNull(record.time) ?? numberOrNull(record.timestamp)
    if (timestamp === null) continue
    if (timestamp < 1_000_000_000_000) {
      timestamp *= 1000
    }
    if (timestamp > max) max = timestamp
  }
  return max === -Infinity ? null : max
}

function computeCounts(
  events: TrendEvent[],
  nowParts: { year: number; month: number; day: number },
  weekStart: "sunday" | "monday",
  dateParts: (date: Date) => { year: number; month: number; day: number }
): { today: number; week: number; month: number; year: number } {
  const todayOrdinal = dateOrdinal(nowParts)
  const weekStartOrdinal = dateOrdinal(resolveWeekStart(nowParts, weekStart))

  let today = 0
  let week = 0
  let month = 0
  let year = 0

  for (const event of events) {
    const parts = dateParts(new Date(event.timestampMs))
    const ordinal = dateOrdinal(parts)
    if (parts.year === nowParts.year) {
      year += event.value
      if (parts.month === nowParts.month) {
        month += event.value
      }
    }
    if (ordinal >= weekStartOrdinal && ordinal <= todayOrdinal) {
      week += event.value
    }
    if (ordinal === todayOrdinal) {
      today += event.value
    }
  }

  return { today, week, month, year }
}
