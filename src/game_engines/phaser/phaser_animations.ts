/* eslint-disable @typescript-eslint/no-explicit-any */

import $j from 'jquery';
import * as arrayUtils from '../../utility/arrayUtils';
import { Game } from '../../game';
import { Animations } from '../../animations';
import Phaser from 'phaser-ce';
import { PhaserHexGrid } from './phaser_hexgrid';
import { PhaserGame } from './phaser_game';
import { Creature } from '../../creature';
import { PhaserCreature } from './phaser_creature';
import { Hex } from '../../utility/hex';

export class PhaserAnimations extends Animations {
	phaser: Phaser;

	constructor(game: Game) {
		super(game);
	}

	walk(creature: Creature, path: Hex[], opts: any): void {
		const game = this.game as PhaserGame;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = Math.random();
		game.animationQueue.push(animId);

		let hexId = 0;

		creature.healthHide();

		const anim = function (this: PhaserAnimations) {
			const hex = path[hexId];

			if (hexId < path.length && (creature.remainingMove > 0 || opts.ignoreMovementPoint)) {
				this.leaveHex(creature, hex, opts);
			} else {
				this.movementComplete(creature, path[path.length - 1], animId, opts);
				return;
			}

			const nextPos = game.grid.hexes[hex.y][hex.x - creature.size + 1];
			const speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

			const tween = game.Phaser.add
				.tween((creature as PhaserCreature).grp)
				.to(nextPos.displayPos, parseInt(speed, 10), Phaser.Easing.Linear.None)
				.start();

			// Ignore traps for hover creatures, unless this is the last hex
			const enterHexOpts = $j.extend(
				{
					ignoreTraps: creature.movementType() !== 'normal' && hexId < path.length - 1,
				},
				opts,
			);

			tween.onComplete.add(() => {
				if (creature.dead) {
					// Stop moving if creature has died while moving
					this.movementComplete(creature, hex, animId, opts);
					return;
				}

				// Sound Effect
				game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

				if (!opts.ignoreMovementPoint) {
					creature.remainingMove--;

					if (opts.customMovementPoint === 0) {
						creature.travelDist++;
					}
				}

				this.enterHex(creature, hex, enterHexOpts);

				anim(this); // Next tween
			});

			hexId++;
		}.bind(this);

		anim();
	}

	fly(creature: any, path: Hex[], opts: any): void {
		const game = this.game as PhaserGame;

		if (opts.customMovementPoint > 0) {
			path = path.slice(0, opts.customMovementPoint);
			// For compatibility
			this.movementPoints = creature.remainingMove;
			creature.remainingMove = opts.customMovementPoint;
		}

		game.freezedInput = true;

		const animId = Math.random();
		game.animationQueue.push(animId);

		creature.healthHide();

		const hex = path[0];

		const start = game.grid.hexes[creature.y][creature.x - creature.size + 1];
		const currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		const speed = !opts.overrideSpeed ? creature.animation.walk_speed : opts.overrideSpeed;

		const tween = game.Phaser.add
			.tween(creature.grp)
			.to(currentHex.displayPos, parseInt(speed, 10), Phaser.Easing.Linear.None)
			.start();

		tween.onComplete.add(() => {
			// Sound Effect
			game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

			if (!opts.ignoreMovementPoint) {
				// Determine distance
				let distance = 0;
				let k = 0;
				while (!distance) {
					k++;

					if (arrayUtils.findPos(start.adjacentHex(k), currentHex)) {
						distance = k;
					}
				}

				creature.remainingMove -= distance;
				if (opts.customMovementPoint === 0) {
					creature.travelDist += distance;
				}
			}

			this.enterHex(creature, hex, opts);
			this.movementComplete(creature, hex, animId, opts);
			return;
		});
	}

	teleport(creature: Creature, path: Hex[], opts: any): void {
		const game = this.game as PhaserGame,
			hex = path[0],
			currentHex = game.grid.hexes[hex.y][hex.x - creature.size + 1];

		this.leaveHex(creature, currentHex, opts);

		const animId = Math.random();
		game.animationQueue.push(animId);

		// FadeOut
		const tween = game.Phaser.add
			.tween((creature as PhaserCreature).grp)
			.to(
				{
					alpha: 0,
				},
				500,
				Phaser.Easing.Linear.None,
			)
			.start();

		tween.onComplete.add(() => {
			// Sound Effect
			game.soundsys.playSound(game.soundLoaded[0], game.soundsys.effectsGainNode);

			// position
			(creature as PhaserCreature).grp.x = currentHex.displayPos.x;
			(creature as PhaserCreature).grp.y = currentHex.displayPos.y;

			// FadeIn
			game.Phaser.add
				.tween((creature as PhaserCreature).grp)
				.to(
					{
						alpha: 1,
					},
					500,
					Phaser.Easing.Linear.None,
				)
				.start();

			this.enterHex(creature, hex, opts);
			this.movementComplete(creature, hex, animId, opts);
			return;
		});
	}

	projectile(
		this2: any,
		target: any,
		spriteId: any,
		path: Hex[],
		args: any,
		startX: any,
		startY: any,
	): any[] {
		// Get the target's position on the projectile's path that is closest
		const emissionPointX = this2.creature.grp.x + startX;
		let distance = Number.MAX_SAFE_INTEGER;
		let targetX = path[0].displayPos.x;
		for (const hex of path) {
			if (typeof hex.creature != 'undefined' && hex.creature.id == target.id) {
				if (distance > Math.abs(emissionPointX - hex.displayPos.x)) {
					distance = Math.abs(emissionPointX - hex.displayPos.x);
					targetX = hex.displayPos.x;
				}
			}
		}
		const game = this.game as PhaserGame,
			baseDist = arrayUtils.filterCreature(path.slice(0), false, false).length,
			dist = baseDist == 0 ? 1 : baseDist,
			emissionPoint = {
				x: this2.creature.grp.x + startX,
				y: this2.creature.grp.y + startY,
			},
			targetPoint = {
				x: targetX + 45,
				y: path[baseDist].displayPos.y - 20,
			},
			// Sprite id here
			sprite = (game.grid as PhaserHexGrid).creatureGroup.create(
				emissionPoint.x,
				emissionPoint.y,
				spriteId,
			),
			duration = dist * 75;

		sprite.anchor.setTo(0.5);
		sprite.rotation = -Math.PI / 3 + (args.direction * Math.PI) / 3;
		const tween = game.Phaser.add
			.tween(sprite)
			.to(
				{
					x: targetPoint.x,
					y: targetPoint.y,
				},
				duration,
				Phaser.Easing.Linear.None,
			)
			.start();

		return [tween, sprite, dist];
	}

	callMethodByStr(str: string, creature: Creature, path: Hex[], opts: any) {
		if (str === 'walk') this.walk(creature, path, opts);
		if (str === 'fly') return this.fly(creature, path, opts);
		if (str === 'teleport') return this.teleport(creature, path, opts);
		if (str === 'enterHex') return this.enterHex(creature, path[0], opts);
		if (str === 'enterHex') return this.leaveHex(creature, path[0], opts);
		return () => {
			console.log(`Animation not recognized: ${str}`);
		};
	}
}
