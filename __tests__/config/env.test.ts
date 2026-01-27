import { describe, expect, it } from "vitest"
import type { Env } from "../../src/config/env"
import {
  assertRequiredEnv,
  getApiBase,
  getInstallationId,
  getLastCoffeeDays,
  getTimezone,
  isSwaggerEnabled
} from "../../src/config/env"

function baseEnv(): Env {
  return {
    LM_EMAIL: "user@example.com",
    LM_PASSWORD: "password",
    KV: {} as KVNamespace
  }
}

describe("env helpers", () => {
  it("assertRequiredEnv throws when required fields are missing", () => {
    expect(() => assertRequiredEnv({} as Env)).toThrow(
      "Missing LM_EMAIL or LM_PASSWORD environment variables."
    )
    expect(() => assertRequiredEnv({ LM_EMAIL: "user", KV: {} as KVNamespace } as Env)).toThrow(
      "Missing LM_EMAIL or LM_PASSWORD environment variables."
    )
    expect(() => assertRequiredEnv({ LM_EMAIL: "user", LM_PASSWORD: "pass" } as Env)).toThrow(
      "Missing KV binding."
    )
  })

  it("returns defaults and parsed values", () => {
    const env = baseEnv()
    expect(getTimezone(env)).toBe("UTC")
    expect(getApiBase(env)).toBe("https://lion.lamarzocco.io/api/customer-app")
    expect(getLastCoffeeDays(env)).toBe(365)
    expect(getInstallationId(env)).toBeUndefined()
  })

  it("parses overrides for env values", () => {
    const env: Env = {
      ...baseEnv(),
      LM_TIMEZONE: " Europe/Copenhagen ",
      LM_API_BASE: " https://api.test ",
      LM_LAST_COFFEE_DAYS: "30",
      LM_INSTALLATION_ID: " ABC "
    }

    expect(getTimezone(env)).toBe("Europe/Copenhagen")
    expect(getApiBase(env)).toBe("https://api.test")
    expect(getLastCoffeeDays(env)).toBe(30)
    expect(getInstallationId(env)).toBe("ABC")
  })

  it("falls back when last coffee days is invalid", () => {
    const env: Env = {
      ...baseEnv(),
      LM_LAST_COFFEE_DAYS: "0"
    }
    expect(getLastCoffeeDays(env)).toBe(365)

    env.LM_LAST_COFFEE_DAYS = "abc"
    expect(getLastCoffeeDays(env)).toBe(365)
  })

  it("detects swagger enablement flags", () => {
    const env = baseEnv()

    env.ENABLE_SWAGGER = "true"
    expect(isSwaggerEnabled(env)).toBe(true)

    env.ENABLE_SWAGGER = "Yes"
    expect(isSwaggerEnabled(env)).toBe(true)

    env.ENABLE_SWAGGER = "1"
    expect(isSwaggerEnabled(env)).toBe(true)

    env.ENABLE_SWAGGER = "false"
    expect(isSwaggerEnabled(env)).toBe(false)
  })
})
