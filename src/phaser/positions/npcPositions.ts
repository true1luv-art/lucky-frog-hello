export interface NpcPositionDef {
  id: string
  x: number
  y: number
  width: number
  height: number
  facing?: 'left' | 'right'
  texture?: string
  event?: string
  /** Display name shown as a floating label above the NPC sprite. */
  name?: string
}

/**
 * Farm NPC spawn definitions.
 * Coordinates are in tile units (multiplied by TILE_SIZE in WorldInteractionSystem).
 */
export const NPC_POSITIONS: NpcPositionDef[] = [
  {
    id: 'npc_barnKeeper',
    x: 20,
    y: 24,
    width: 2,
    height: 2,
    facing: 'right',
    event: 'phaser-barn-open',
    name: 'Barn Keeper',
  },
  {
    id: 'npc_trader',
    x: 36,
    y: 21,
    width: 2,
    height: 2,
    facing: 'right',
    event: 'phaser-trader-open',
    name: 'Trader',
  },
]
