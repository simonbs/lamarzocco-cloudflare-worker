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
