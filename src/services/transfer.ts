/**
 * Utilidades para compartir texto (formato Showdown) por enlace y portapapeles.
 * La serialización/parseo del formato vive en `showdown.ts`.
 */

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): string {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/** Codifica el texto de un equipo/build para un enlace compartible (query param). */
export function encodeShare(text: string): string {
  return toBase64Url(text)
}

/** Decodifica el código de un enlace y devuelve el texto original. */
export function decodeShare(code: string): string {
  return fromBase64Url(code)
}

/** Copia texto al portapapeles; devuelve si tuvo éxito. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
