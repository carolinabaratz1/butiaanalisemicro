/**
 * Returns a safe href value, allowing only http(s) and mailto/tel schemes.
 * Falls back to '#' for javascript: and other dangerous URIs.
 */
export function safeHref(url: string | null | undefined): string {
  if (!url) return '#';
  const trimmed = String(url).trim();
  if (!trimmed) return '#';
  // Allow relative URLs starting with / or #
  if (/^[/#?]/.test(trimmed)) return trimmed;
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return '#';
}
