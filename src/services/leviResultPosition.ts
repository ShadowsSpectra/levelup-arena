type Box = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>
export type Position = { left: number; top: number; width?: number }

/** Find a full-size position without covering the real result actions. */
export function resultCommentPosition(width: number, height: number, viewportWidth: number, viewportHeight: number, actions: readonly Box[]): Position | null {
  const margin = 16
  if (width <= 0 || height <= 0 || width > viewportWidth - 2 * margin || height > viewportHeight - 2 * margin) return null
  const xs = [viewportWidth - margin - width, margin, ...actions.flatMap((r) => [r.left - width - margin, r.right + margin])]
  const ys = [viewportHeight - margin - height, margin, ...actions.flatMap((r) => [r.top - height - margin, r.bottom + margin])]
  for (const top of ys) for (const left of xs) {
    if (left < margin || top < margin || left + width > viewportWidth - margin || top + height > viewportHeight - margin) continue
    if (actions.some((r) => left < r.right + 4 && left + width > r.left - 4 && top < r.bottom + 4 && top + height > r.top - 4)) continue
    return { left, top }
  }
  return null
}
