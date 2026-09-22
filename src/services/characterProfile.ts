import type { Character } from '../types/arena'

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

export function getCharacterPublicProfile(character: Character) {
  return `${styleLabels[character.communicationStyle] ?? character.communicationStyle}. Давление: ${pressureLabels[character.pressure]}.`
}

export function getDifficultyStars(difficulty: number) {
  const filled = Math.min(3, Math.max(1, difficulty))
  return '★'.repeat(filled) + '☆'.repeat(3 - filled)
}
