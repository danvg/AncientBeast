/**
	* Configure renderer specific implementations for relevant types.
	*/

import { PhaserAbility } from './game_engines/phaser/phaser_ability'
import { PhaserAnimations } from './game_engines/phaser/phaser_animations'
import { PhaserCreature } from './game_engines/phaser/phaser_creature'
import { PhaserDrop } from './game_engines/phaser/phaser_drops'
import { PhaserGame } from './game_engines/phaser/phaser_game'
import { PhaserHex } from './game_engines/phaser/phaser_hex'
import { PhaserHexGrid } from './game_engines/phaser/phaser_hexgrid'

export const AbilityImpl = process.env.RENDERER === 'phaser' ? PhaserAbility : null;
export const AnimationsImpl = process.env.RENDERER === 'phaser' ? PhaserAnimations : null;
export const CreatureImpl = process.env.RENDERER === 'phaser' ? PhaserCreature : null;
export const DropImpl = process.env.RENDERER === 'phaser' ? PhaserDrop : null;
export const GameImpl = process.env.RENDERER === 'phaser' ? PhaserGame : null;
export const HexImpl = process.env.RENDERER === 'phaser' ? PhaserHex : null;
export const HexGridImpl = process.env.RENDERER === 'phaser' ? PhaserHexGrid : null;
