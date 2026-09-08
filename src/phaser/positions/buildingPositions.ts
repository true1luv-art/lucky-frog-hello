export const BUILDING_KEYS = [
  'summoning_shrine',
] as const

export type BuildingKey = (typeof BUILDING_KEYS)[number]

export interface BuildingZoneDef {
  type: string
  x: number
  y: number
  width: number
  height: number
}

export const BUILDING_POSITIONS: BuildingZoneDef[] = [
  { type: 'house', x: 13, y: 13, width: 3, height: 4 },
  // firepit.png — 2×2 tiles; both firepits open the cooking modal
  { type: 'firepit_1', x: 36, y: 12, width: 2, height: 2 },
  { type: 'firepit_2', x: 33, y: 12, width: 2, height: 2 },

  // market.png / blacksmith.png — 80×80 px native → displayed at 5×5 tiles
  { type: 'market', x: 14, y: 1, width: 5, height: 5 },
  { type: 'blacksmith', x: 34, y: 1, width: 5, height: 5 },
  // summoning_shrine.png — 32×48 px native (2:3) → displayed at 2×3 tiles
  { type: 'summoning_shrine', x: 16, y: 16, width: 2, height: 3 },
]
