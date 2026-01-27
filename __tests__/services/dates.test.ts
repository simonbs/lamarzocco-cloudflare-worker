import { describe, expect, it } from "vitest"
import { createDatePartsExtractor, dateOrdinal } from "../../src/services/dates"

describe("dates helpers", () => {
  it("extracts date parts in UTC", () => {
    const extractor = createDatePartsExtractor("UTC")
    const parts = extractor(new Date("2024-01-02T03:04:05Z"))
    expect(parts).toEqual({ year: 2024, month: 1, day: 2 })
  })

  it("extracts date parts in a specific timezone", () => {
    const extractor = createDatePartsExtractor("America/Los_Angeles")
    const parts = extractor(new Date("2024-01-02T07:00:00Z"))
    expect(parts).toEqual({ year: 2024, month: 1, day: 1 })
  })

  it("returns a UTC ordinal", () => {
    const ordinal = dateOrdinal({ year: 2024, month: 1, day: 2 })
    expect(ordinal).toBe(Date.UTC(2024, 0, 2))
  })
})
