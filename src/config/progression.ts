export const levelThresholds = [
  { level: 1, minXp: 0 },
  { level: 2, minXp: 100 },
  { level: 3, minXp: 250 },
] as const

export const energyRules = {
  maximum: 6,
  trainingCost: 1,
  allowTrainingAtZero: true,
} as const

export const arenaRewards = {
  successXp: 50,
} as const
