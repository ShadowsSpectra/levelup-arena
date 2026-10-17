type Box = Pick<DOMRect, 'top' | 'bottom'>

/** An out-of-flow guide below the real target, horizontally clamped to the viewport. */
export function getLeviHomeGuidePosition(anchor: Box & { left: number; right: number }, width: number, viewportWidth: number, scrollY: number) {
  return {
    top: scrollY + anchor.bottom + 16,
    left: Math.max(16, Math.min((anchor.left + anchor.right - width) / 2, viewportWidth - width - 16)),
  }
}

/** Minimal scrolling, using actual geometry; if space is scarce the control wins. */
export function getLeviHomeScrollTop(
  guide: Box, targets: readonly Box[], scrollY: number, viewportHeight: number, priority?: Box,
) {
  const margin = 16
  const available = Math.max(0, viewportHeight - margin * 2)
  const all = [guide, ...targets]
  let top = Math.min(...all.map((box) => box.top))
  let bottom = Math.max(...all.map((box) => box.bottom))
  if (bottom - top > available && targets.length) {
    const preferred = priority ?? targets[0]
    top = preferred.top
    bottom = preferred.bottom
  }
  if (top < margin || bottom - top > available) return Math.max(0, scrollY + top - margin)
  if (bottom > viewportHeight - margin) return Math.max(0, scrollY + bottom - viewportHeight + margin)
  return scrollY
}

/** Keep the real target above the measured, fixed mobile guide. */
export function getLeviMobileScrollTop(targets: readonly Box[], scrollY: number, guideTop: number, priority?: Box) {
  if (!targets.length) return scrollY
  const margin = 16
  const top = Math.min(...targets.map((box) => box.top))
  const bottom = Math.max(...targets.map((box) => box.bottom))
  const available = Math.max(0, guideTop - margin * 2)
  const visible = bottom - top <= available ? { top, bottom } : (priority ?? { top, bottom })
  // A tall card cannot fit: keep its heading and primary action visible when possible.
  if (visible.bottom > guideTop - margin) return Math.max(0, scrollY + visible.bottom - guideTop + margin)
  if (visible.top < margin) return Math.max(0, scrollY + visible.top - margin)
  return scrollY
}

export function highlightLeviHomeTargets(root: HTMLElement, ids: readonly string[]) {
  const targets = ids.flatMap((id) => {
    const target = root.querySelector<HTMLElement>(`[data-tour="${id}"]`)
    return target ? [target] : []
  })
  targets.forEach((target) => target.setAttribute('data-levi-highlighted', 'true'))
  return {
    targets,
    missing: targets.length !== ids.length,
    cleanup: () => targets.forEach((target) => target.removeAttribute('data-levi-highlighted')),
  }
}
