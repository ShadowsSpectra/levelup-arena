/** Visual-only controller. It never clicks a card or writes selection/ARIA state. */
export function startLeviRoleHighlight(root: HTMLElement) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-tour="role-cards"] [data-tour="role-card"]'))
  cards.forEach((card) => card.setAttribute('data-tour-highlighted', 'true'))
  return () => cards.forEach((card) => card.removeAttribute('data-tour-highlighted'))
}
