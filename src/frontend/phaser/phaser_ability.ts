import $j from 'jquery';
import Game from '../../game';
import { Ability } from '../ability';
import { Creature } from '../../creature';
import { Hex } from '../../utility/hex';

export class PhaserAbility extends Ability {
	constructor(creature: Creature, abilityID: number, game: Game) {
		super(creature, abilityID, game);

		// Events
		this.game.signals.metaPowers.add(this.handleMetaPowerEvent, this);
	}

	/**
	 * Animate the creature
	 * @return {void}
	 */
	animation(): void | boolean {
		let game = this.game;
		// Gamelog Event Registration

		const trigger = this.getTrigger();
		let triggerStr: string;
		if (trigger instanceof String) {
			triggerStr = trigger as string;
		} else if (trigger instanceof Function) {
			triggerStr = trigger();
		}

		if (triggerStr && game.triggers.onQuery.test(triggerStr)) {
			if (arguments[0] instanceof Hex) {
				let args = $j.extend({}, arguments);
				delete args[0];
				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'hex',
						x: arguments[0].x,
						y: arguments[0].y,
					},
					id: this.id,
					args: args,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'hex',
							x: arguments[0].x,
							y: arguments[0].y,
						},
						id: this.id,
						args: args,
					});
				}
			}

			if (arguments[0] instanceof Creature) {
				let args = $j.extend({}, arguments);
				delete args[0];
				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'creature',
						crea: arguments[0].id,
					},
					id: this.id,
					args: args,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'creature',
							crea: arguments[0].id,
						},
						id: this.id,
						args: args,
					});
				}
			}

			if (arguments[0] instanceof Array) {
				let args = $j.extend({}, arguments);
				delete args[0];

				let array = arguments[0].map((item) => ({ x: item.x, y: item.y }));

				game.gamelog.add({
					action: 'ability',
					target: {
						type: 'array',
						array: array,
					},
					id: this.id,
					args: args,
				});
				if (game.multiplayer) {
					game.gameplay.useAbility({
						target: {
							type: 'array',
							array: array,
						},
						id: this.id,
						args: args,
					});
				}
			}
		} else {
			// Test for materialization sickness
			if (this.creature.materializationSickness && this.affectedByMatSickness) {
				return false;
			}
		}

		return this.animation2({
			arg: arguments,
		});
	}

	/**
	 * Helper to animation method.
	 * @param {Object} o Animation object to extend.
	 * @return {void}
	 */
	animation2(o: Object): void {
		const game = this.game;
		const opt = $j.extend(
			{
				callback: function () {
					// Default no-op function.
				},
				arg: {},
			},
			o,
		);
		const args = opt.arg;
		const activateAbility = () => {
			const extra = args[2];
			this.activate(args[0], args[1], extra);
			this.postActivate();
		};

		game.freezedInput = true;

		// Animate
		let p0 = this.creature.sprite.x;
		let p1 = p0;
		let p2 = p0;

		p1 += this.creature.player.flipped ? 5 : -5;
		p2 += this.creature.player.flipped ? -5 : 5;

		this.creature.facePlayerDefault();

		// Force creatures to face towards their target
		if (args[0]) {
			if (args[0] instanceof Creature) {
				this.creature.faceHex(args[0]);
			} else if (args[0] instanceof Array) {
				for (var argument of args[0]) {
					if (argument instanceof Creature || argument.creature) {
						this.creature.faceHex(argument);
					}
				}
			}
		}
		// Play animations and sounds only for active abilities
		if (this.getTrigger() === 'onQuery') {
			let animId = Math.random();

			game.animationQueue.push(animId);

			let animationData = {
				duration: 500,
				delay: 350,
				activateAnimation: true,
			};

			if (this.getAnimationData) {
				animationData = $j.extend(animationData, this.getAnimationData(...args));
			}

			if (animationData.activateAnimation) {
				game.Phaser.add
					.tween(this.creature.sprite)
					.to({ x: p1 }, 250, Phaser.Easing.Linear.None)
					.to({ x: p2 }, 100, Phaser.Easing.Linear.None)
					.to({ x: p0 }, 150, Phaser.Easing.Linear.None)
					.start();
			}

			setTimeout(() => {
				if (!game.triggers.onUnderAttack.test(this.getTrigger())) {
					game.soundsys.playSound(game.soundLoaded[2], game.soundsys.effectsGainNode);
					activateAbility();
				}
			}, animationData.delay);

			setTimeout(() => {
				let queue = game.animationQueue.filter((item) => item != animId);

				if (queue.length === 0) {
					game.freezedInput = false;
					if (game.multiplayer) {
						game.freezedInput = game.UI.active ? false : true;
					}
				}

				game.animationQueue = queue;
			}, animationData.duration);
		} else {
			activateAbility();
			if (game.animationQueue.length === 0) {
				game.freezedInput = false;
			}
		}

		let interval = setInterval(() => {
			if (!game.freezedInput) {
				clearInterval(interval);
				opt.callback();
			}
		}, 100);
	}
}
