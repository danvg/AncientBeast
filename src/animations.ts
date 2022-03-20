import { Game } from './game';
import { Creature } from './creature';
import { Hex } from './utility/hex';

export abstract class Animations {
	creature: Creature;
	game: Game;
	movementPoints: number;
	walk_speed: number;

	constructor(game: Game) {
		this.game = game;
		this.movementPoints = 0;
	}

	abstract walk(creature: Creature, path: Hex[], opts: any): void;
	abstract fly(creature: Creature, path: Hex[], opts: any): void;
	abstract teleport(creature: Creature, path: Hex[], opts: any): void;

	abstract projectile(
		this2: any,
		target: any,
		spriteId: any,
		path: Hex[],
		args: any,
		startX: number,
		startY: number,
	): any[];

	push(creature: Creature, path: Hex[], opts: any) {
		opts.pushed = true;
		this.walk(creature, path, opts);
	}

	//--------Special Functions---------//

	enterHex(creature: Creature, hex: Hex, opts: any) {
		const game = this.game;

		creature.cleanHex();
		creature.x = hex.x - 0;
		creature.y = hex.y - 0;
		creature.pos = hex.pos;
		creature.updateHex();

		game.onStepIn(creature, hex, opts);

		creature.pickupDrop();

		opts.callbackStepIn(hex);

		game.grid.orderCreatureZ();
	}

	leaveHex(creature: Creature, hex: Hex, opts: any) {
		const game = this.game;

		if (!opts.pushed) {
			creature.faceHex(hex, creature.hexagons[0]); // Determine facing
		}

		game.onStepOut(creature, creature.hexagons[0]); // Trigger
		game.grid.orderCreatureZ();
	}

	movementComplete(creature: Creature, hex: Hex, animId: number, opts: any) {
		const game = this.game;

		if (opts.customMovementPoint > 0) {
			creature.remainingMove = this.movementPoints;
		}

		// TODO: Turn around animation
		if (opts.turnAroundOnComplete) {
			creature.facePlayerDefault();
		}

		// TODO: Reveal health indicator
		creature.healthShow();

		creature.hexagons.forEach((h) => {
			h.pickupDrop(creature);
		});

		game.grid.orderCreatureZ();

		const queue = game.animationQueue.filter((item) => item != animId);

		if (queue.length === 0) {
			game.freezedInput = false;
			if (game.multiplayer) {
				game.freezedInput = game.UI.active ? false : true;
			}
		}

		game.animationQueue = queue;
	}

	abstract callMethodByStr(str: string, creature: Creature, path: Hex[], opts: any);
}
