import type { PublicCharacter } from '../types/arena'

const styleLabels: Record<string, string> = {
  'neutral-professional': 'Спокойный деловой стиль',
  friendly: 'Дружелюбный стиль',
  formal: 'Формальный стиль',
  direct: 'Прямой стиль',
  tough: 'Жёсткий стиль',
  provocative: 'Провокационный стиль',
  reserved: 'Сдержанный стиль',
}

const pressureLabels = { low: 'низкое', medium: 'умеренное', high: 'высокое' }

export function getCharacterPublicProfile(character: PublicCharacter) {
  return `${styleLabels[character.communicationStyle] ?? character.communicationStyle}. Давление: ${pressureLabels[character.pressure]}.`
}

export function getCharacterStyleLabel(character: PublicCharacter) {
  return styleLabels[character.communicationStyle] ?? character.communicationStyle
}

export function getCharacterPressureLabel(character: PublicCharacter) {
  const pressure = pressureLabels[character.pressure]
  return `${pressure.charAt(0).toUpperCase()}${pressure.slice(1)} давление`
}

export function getDifficultyLabel(difficulty: number) {
  if (difficulty <= 1) return 'Легко'
  if (difficulty === 2) return 'Средне'
  return 'Сложно'
}

export function getDifficultyStars(difficulty: number) {
  const filled = Math.min(3, Math.max(1, difficulty))
  return '★'.repeat(filled) + '☆'.repeat(3 - filled)
}
