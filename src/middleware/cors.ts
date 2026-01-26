export function applyCorsHeaders(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", "*")
}

export function buildOptionsResponse(): Response {
  const headers = new Headers()
  applyCorsHeaders(headers)
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS")
  headers.set("Access-Control-Allow-Headers", "Content-Type")
  headers.set("Access-Control-Max-Age", "86400")
  return new Response(null, { status: 204, headers })
}
