import type { InstallationKeyData } from "./types"

export function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(data))
  return new Uint8Array(digest)
}

export async function deriveSecretBytes(
  installationId: string,
  publicKeyDer: Uint8Array
): Promise<Uint8Array> {
  const publicKeyB64 = bytesToBase64(publicKeyDer)
  const installationHash = await sha256Bytes(utf8ToBytes(installationId))
  const installationHashB64 = bytesToBase64(installationHash)
  const triple = `${installationId}.${publicKeyB64}.${installationHashB64}`
  return sha256Bytes(utf8ToBytes(triple))
}

export async function generateRequestProof(
  baseString: string,
  secret32: Uint8Array
): Promise<string> {
  if (secret32.length !== 32) {
    throw new Error("Secret must be 32 bytes.")
  }
  const work = new Uint8Array(secret32)
  const bytes = utf8ToBytes(baseString)

  for (const byteVal of bytes) {
    const idx = byteVal % 32
    const shiftIdx = (idx + 1) % 32
    const shiftAmount = work[shiftIdx] & 7
    const xorResult = byteVal ^ work[idx]
    const rotated = ((xorResult << shiftAmount) | (xorResult >> (8 - shiftAmount))) & 0xff
    work[idx] = rotated
  }

  const digest = await sha256Bytes(work)
  return bytesToBase64(digest)
}

export async function buildSignedHeaders(
  key: InstallationKeyData
): Promise<Record<string, string>> {
  const nonce = crypto.randomUUID().toLowerCase()
  const timestamp = Date.now().toString()
  const proofInput = `${key.installationId}.${nonce}.${timestamp}`
  const proof = await generateRequestProof(proofInput, base64ToBytes(key.secretB64))
  const signatureData = `${proofInput}.${proof}`

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    key.privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    toArrayBuffer(utf8ToBytes(signatureData))
  )

  const signatureBytes = new Uint8Array(signature)
  const derSignature = toDerSignature(signatureBytes)
  return {
    "X-App-Installation-Id": key.installationId,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Request-Signature": bytesToBase64(derSignature)
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function toDerSignature(signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) {
    return signature
  }
  const r = signature.slice(0, 32)
  const s = signature.slice(32)
  const rDer = encodeDerInteger(r)
  const sDer = encodeDerInteger(s)
  const sequenceLength = rDer.length + sDer.length
  return new Uint8Array([0x30, sequenceLength, ...rDer, ...sDer])
}

function encodeDerInteger(bytes: Uint8Array): number[] {
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start += 1
  }
  let value = Array.from(bytes.slice(start))
  if (value[0] >= 0x80) {
    value = [0x00, ...value]
  }
  return [0x02, value.length, ...value]
}
