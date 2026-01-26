export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface InstallationKeyData {
  installationId: string
  secretB64: string
  privateKeyJwk: JsonWebKey
  publicKeyB64: string
}

export interface TrendEvent {
  timestampMs: number
  value: number
}

export interface DateParts {
  year: number
  month: number
  day: number
}
