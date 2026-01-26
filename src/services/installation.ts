import type { Env } from "../config/env"
import { getApiBase, getInstallationId } from "../config/env"
import type { InstallationKeyData } from "./types"
import {
  base64ToBytes,
  bytesToBase64,
  deriveSecretBytes,
  generateRequestProof,
  sha256Bytes
} from "./crypto"

const INSTALLATION_KEY_STORAGE = "installation_key"
const CLIENT_REGISTERED_STORAGE = "client_registered"

export async function loadInstallationKey(env: Env): Promise<InstallationKeyData> {
  const existing = await env.KV.get<InstallationKeyData>(INSTALLATION_KEY_STORAGE, "json")
  if (existing) {
    const requestedId = getInstallationId(env)
    if (requestedId && existing.installationId !== requestedId) {
      console.warn(
        "LM_INSTALLATION_ID differs from stored installation key; using stored installation key to avoid re-registration."
      )
    }
    return existing
  }

  const installationId = (getInstallationId(env) || crypto.randomUUID()).toLowerCase()
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  )

  const privateKeyJwk = (await crypto.subtle.exportKey("jwk", keyPair.privateKey)) as JsonWebKey
  const publicKeySpki = await crypto.subtle.exportKey("spki", keyPair.publicKey)
  const publicKeyB64 = bytesToBase64(new Uint8Array(publicKeySpki))

  const secretBytes = await deriveSecretBytes(installationId, new Uint8Array(publicKeySpki))
  const secretB64 = bytesToBase64(secretBytes)

  const installationKey: InstallationKeyData = {
    installationId,
    secretB64,
    privateKeyJwk,
    publicKeyB64
  }

  await env.KV.put(INSTALLATION_KEY_STORAGE, JSON.stringify(installationKey))
  return installationKey
}

export async function ensureClientRegistered(env: Env, key: InstallationKeyData): Promise<void> {
  const registered = await env.KV.get(CLIENT_REGISTERED_STORAGE)
  if (registered === "true") return

  const pubBytes = base64ToBytes(key.publicKeyB64)
  const pubHash = await sha256Bytes(pubBytes)
  const baseString = `${key.installationId}.${bytesToBase64(pubHash)}`
  const proof = await generateRequestProof(baseString, base64ToBytes(key.secretB64))

  const res = await fetch(`${getApiBase(env)}/auth/init`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-App-Installation-Id": key.installationId,
      "X-Request-Proof": proof
    },
    body: JSON.stringify({ pk: key.publicKeyB64 })
  })

  if (res.ok) {
    await env.KV.put(CLIENT_REGISTERED_STORAGE, "true")
    return
  }

  const text = await res.text()
  throw new Error(`Client registration failed: ${res.status} ${text}`)
}
