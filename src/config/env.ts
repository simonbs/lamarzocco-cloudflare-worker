export interface Env {
  LM_EMAIL: string
  LM_PASSWORD: string
  LM_TIMEZONE?: string
  LM_MACHINE_ID?: string
  LM_LAST_COFFEE_DAYS?: string
  LM_INSTALLATION_ID?: string
  LM_API_BASE?: string
  KV: KVNamespace
  ENABLE_SWAGGER?: string
}

export function assertRequiredEnv(env: Env): void {
  if (!env.LM_EMAIL || !env.LM_PASSWORD) {
    throw new Error("Missing LM_EMAIL or LM_PASSWORD environment variables.")
  }
  if (!env.KV) {
    throw new Error("Missing KV binding.")
  }
}

export function getTimezone(env: Env): string {
  return env.LM_TIMEZONE?.trim() || "UTC"
}

export function getLastCoffeeDays(env: Env): number {
  return parsePositiveInt(env.LM_LAST_COFFEE_DAYS, 365)
}

export function getApiBase(env: Env): string {
  return env.LM_API_BASE?.trim() || "https://lion.lamarzocco.io/api/customer-app"
}

export function getInstallationId(env: Env): string | undefined {
  return env.LM_INSTALLATION_ID?.trim() || undefined
}

export function isSwaggerEnabled(env: Env): boolean {
  const raw = env.ENABLE_SWAGGER?.trim().toLowerCase()
  if (!raw) {
    return false
  }

  return raw === "1" || raw === "true" || raw === "yes"
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}
