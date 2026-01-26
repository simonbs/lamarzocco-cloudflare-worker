import type { Env } from "../config/env"
import { getApiBase } from "../config/env"
import type { InstallationKeyData, TokenData } from "./types"
import { buildSignedHeaders } from "./crypto"
import { ensureClientRegistered } from "./installation"

const TOKEN_TTL_MS = 60 * 60 * 1000
const TOKEN_REFRESH_WINDOW_MS = 10 * 60 * 1000
const TOKEN_STORAGE = "tokens"

export async function getAccessToken(env: Env, key: InstallationKeyData): Promise<string> {
  await ensureClientRegistered(env, key)

  const existing = await env.KV.get<TokenData>(TOKEN_STORAGE, "json")
  if (existing && existing.expiresAt - TOKEN_REFRESH_WINDOW_MS > Date.now()) {
    return existing.accessToken
  }

  if (existing?.refreshToken) {
    try {
      const refreshed = await refreshToken(env, key, existing.refreshToken)
      await env.KV.put(TOKEN_STORAGE, JSON.stringify(refreshed))
      return refreshed.accessToken
    } catch (error) {
      console.warn("Refresh token failed, falling back to sign-in.", error)
    }
  }

  const signedIn = await signIn(env, key)
  await env.KV.put(TOKEN_STORAGE, JSON.stringify(signedIn))
  return signedIn.accessToken
}

async function signIn(env: Env, key: InstallationKeyData): Promise<TokenData> {
  const headers = await buildSignedHeaders(key)
  const response = await fetch(`${getApiBase(env)}/auth/signin`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json"
    },
    body: JSON.stringify({ username: env.LM_EMAIL, password: env.LM_PASSWORD })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Sign-in failed (${response.status}): ${text}`)
  }

  const data = (await response.json()) as { accessToken?: string; refreshToken?: string }
  if (!data.accessToken || !data.refreshToken) {
    throw new Error("Sign-in response missing accessToken or refreshToken.")
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + TOKEN_TTL_MS
  }
}

async function refreshToken(
  env: Env,
  key: InstallationKeyData,
  refreshTokenValue: string
): Promise<TokenData> {
  const headers = await buildSignedHeaders(key)
  const response = await fetch(`${getApiBase(env)}/auth/refreshtoken`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json"
    },
    body: JSON.stringify({ username: env.LM_EMAIL, refreshToken: refreshTokenValue })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Refresh token failed (${response.status}): ${text}`)
  }

  const data = (await response.json()) as { accessToken?: string; refreshToken?: string }
  if (!data.accessToken || !data.refreshToken) {
    throw new Error("Refresh response missing accessToken or refreshToken.")
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + TOKEN_TTL_MS
  }
}

export async function clearTokenCache(env: Env): Promise<void> {
  await env.KV.delete(TOKEN_STORAGE)
}
