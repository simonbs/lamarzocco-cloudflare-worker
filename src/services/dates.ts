import type { DateParts } from "./types"

export function createDatePartsExtractor(timeZone: string): (date: Date) => DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })

  return (date: Date) => {
    const parts = formatter.formatToParts(date)
    const lookup: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== "literal") {
        lookup[part.type] = part.value
      }
    }
    return {
      year: Number.parseInt(lookup.year, 10),
      month: Number.parseInt(lookup.month, 10),
      day: Number.parseInt(lookup.day, 10)
    }
  }
}

export function dateOrdinal(parts: DateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day)
}

export function getWeekStart(parts: DateParts, weekStart: "sunday" | "monday"): DateParts {
  const weekdayIndex = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  const weekStartIndex = weekStart === "monday" ? 1 : 0
  const diff = (weekdayIndex - weekStartIndex + 7) % 7
  return addDays(parts, -diff)
}

export function addDays(parts: DateParts, delta: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  }
}

export function daysSinceYearStart(parts: DateParts): number {
  const yearStart = Date.UTC(parts.year, 0, 1)
  const today = Date.UTC(parts.year, parts.month - 1, parts.day)
  return Math.floor((today - yearStart) / 86_400_000) + 1
}
