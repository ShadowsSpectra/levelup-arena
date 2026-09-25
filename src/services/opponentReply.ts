const outerQuotes: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'], ['«', '»'], ['“', '”'],
]

export function sanitizeOpponentReply(reply: string, characterName: string): string {
  const trimmed = reply.trim()
  const escapedName = characterName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const prefix = escapedName ? new RegExp(`^${escapedName}\\s*[:：—–]\\s*`, 'iu') : null
  let cleaned = prefix ? trimmed.replace(prefix, '').trim() : trimmed
  if (!cleaned) return trimmed

  for (const [open, close] of outerQuotes) {
    if (cleaned.startsWith(open) && cleaned.endsWith(close) && cleaned.length > open.length + close.length) {
      cleaned = cleaned.slice(open.length, -close.length).trim() || cleaned
      break
    }
  }
  return cleaned
}
