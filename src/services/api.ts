import type { Env } from "../config/env"
import { getApiBase } from "../config/env"
import type { InstallationKeyData } from "./types"
import { buildSignedHeaders } from "./crypto"
import { clearTokenCache, getAccessToken } from "./auth"

export async function apiGet(env: Env, key: InstallationKeyData, path: string): Promise<any> {
  const token = await getAccessToken(env, key)
  const headers = await buildSignedHeaders(key)
  headers.Authorization = `Bearer ${token}`

  let response = await fetch(`${getApiBase(env)}${path}`, {
    method: "GET",
    headers
  })

  if (response.status === 401) {
    await clearTokenCache(env)
    const retryToken = await getAccessToken(env, key)
    const retryHeaders = await buildSignedHeaders(key)
    retryHeaders.Authorization = `Bearer ${retryToken}`
    response = await fetch(`${getApiBase(env)}${path}`, {
      method: "GET",
      headers: retryHeaders
    })
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API request failed (${response.status}): ${text}`)
  }

  return response.json()
}
