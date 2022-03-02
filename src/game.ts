import $j from 'jquery';
import { Animations } from './frontend/animations';
import { CreatureQueue } from './creature_queue';
import { GameLog } from './utility/gamelog';
import { SoundSys } from './sound/soundsys';
import { MusicPlayer } from './sound/musicplayer';
import { HexGrid } from './frontend/hexgrid';
import { getUrl } from './assetLoader';
import { Player } from './player';
import { UI } from './ui/interface';
import { Creature } from './frontend/creature';
import dataJson from './data/units.json';
import Phaser, { Signal } from 'phaser-ce';
import MatchI from './multiplayer/match';
import Gameplay from './multiplayer/gameplay';
import { sleep } from './utility/time';
import { PhaserHexGrid } from './frontend/phaser/phaser_hexgrid';
import { PhaserAnimations } from './frontend/phaser/phaser_animations';
import { Ability } from './frontend/ability';
import { Effect } from './effect';
import { PhaserHex } from './frontend/phaser/phaser_hex';
import SessionI from './multiplayer/session';
import { Client } from '@heroiclabs/nakama-js';
import { Hex } from './frontend/hex';
import { Trap } from './frontend/trap';

/**
 * Game Class
 *
 * Game contains all Game elements and functions.
 * It's the root element and defined only one time through the G variable.
 *
 * NOTE: Constructor does nothing because the G object must be defined
 * before creating other class instances. The game setup is triggered
 * to really start the game.
 */
export default class Game {
	Phaser: Phaser.Game;

	version: string;
	abilities: Ability[];
	players: Player[];
	creatures: Creature[];
	effects: Effect[];
	activeCreature: Creature;
	matchid: any; // what type is this?
	playersReady: boolean;
	preventSetup: boolean;
	animations: Animations;
	queue: CreatureQueue;
	creatureIdCounter: number;
	creatureData: any[];
	gameState: string;
	pause: boolean;
	pauseTime: number;
	pauseStartTime: Date;
	minimumTurnBeforeFleeing: number;
	availableCreatures: string[];
	animationQueue: number[];
	checkTimeFrequency: number;
	gamelog: GameLog;
	configData: {};
	match: MatchI;
	gameplay: Gameplay;
	session: SessionI;
	client: Client;
	connect: any;
	debugMode: string;
	multiplayer: boolean;
	matchInitialized: boolean;
	realms: string[];
	availableMusic: any[];
	soundEffects: string[];
	inputMethod: string;
	firstKill: boolean;
	freezedInput: boolean;
	turnThrottle: boolean;
	turn: number;
	msg: any;
	triggers: any;
	signals: any;
	musicPlayer: MusicPlayer;
	soundLoaded: any;
	soundsys: SoundSys;
	background_image: string;
	UI: UI;
	trapId: number;
	dropId: number;
	grid: HexGrid;
	startMatchTime: Date;
	$combatFrame: JQuery<HTMLElement>;
	timeInterval: NodeJS.Timeout;
	windowResizeTimeout: NodeJS.Timeout;
	playerMode: number;
	timePool: number;
	turnTimePool: number;
	endGameSound: any;

	/**
	 * Attributes
	 *
	 * NOTE : attributes and variables starting with $ are jQuery elements
	 * and jQuery functions can be called directly from them.
	 *
	 * // jQuery attributes
	 * $combatFrame :	Combat element containing all graphics except the UI
	 *
	 * // Game elements
	 * players :			Array :	Contains Player objects ordered by player ID (0 to 3)
	 * creatures :			Array :	Contains Creature objects (creatures[creature.id]) start at index 1
	 *
	 * grid :				Grid :	Grid object
	 * UI :				UI :	UI object
	 *
	 * queue :				CreatureQueue :	queue of creatures to manage phase order
	 *
	 * turn :				Integer :	Current's turn number
	 *
	 * // Normal attributes
	 * playerMode :		Integer :	Number of players in the game
	 * activeCreature :	Creature :	Current active creature object reference
	 * creatureIdCounter :		Integer :	Creature ID counter used for creature creation
	 * creatureData :		Array :		Array containing all data for the creatures
	 *
	 */
	constructor(version?: string) {
		this.version = version || 'dev';
		this.abilities = [];
		this.players = [];
		this.creatures = [];
		this.effects = [];
		this.activeCreature = { id: 0 } as Creature;
		this.matchid = null;
		this.playersReady = false;
		this.preventSetup = false;
		this.animations = new PhaserAnimations(this);
		this.queue = new CreatureQueue(this);
		this.creatureIdCounter = 1;
		this.creatureData = [];
		this.pause = false;
		this.gameState = 'initialized';
		this.pauseTime = 0;
		this.minimumTurnBeforeFleeing = 12;
		this.availableCreatures = [];
		this.animationQueue = [];
		this.checkTimeFrequency = 1000;
		this.gamelog = new GameLog(null, this);
		this.configData = {};
		this.match = {} as MatchI;
		this.gameplay = {} as Gameplay;
		this.session = null;
		this.client = null;
		this.connect = null;
		this.debugMode = process.env.DEBUG_MODE;
		this.multiplayer = false;
		this.matchInitialized = false;
		this.realms = ['A', 'E', 'G', 'L', 'P', 'S', 'W'];
		this.availableMusic = [];
		this.soundEffects = [
			'sounds/step',
			'sounds/swing',
			'sounds/swing2',
			'sounds/swing3',
			'sounds/heartbeat',
			'sounds/drums',
			'sounds/upgrade',
		];
		this.inputMethod = 'Mouse';

		// Gameplay properties
		this.firstKill = false;
		this.freezedInput = false;
		this.turnThrottle = false;
		this.turn = 0;

		// Phaser
		this.Phaser = new Phaser.Game(1920, 1080, Phaser.AUTO, 'combatwrapper', {
			update: this.phaserUpdate.bind(this),
			render: this.phaserRender.bind(this),
		});

		// Messages
		// TODO: Move strings to external file in order to be able to support translations
		// https://github.com/FreezingMoon/AncientBeast/issues/923
		this.msg = {
			abilities: {
				noTarget: 'No targets available.',
				noPlasma: 'Not enough plasma.',
				noPsy: 'Psyhelm overload: too many units!',
				alreadyUsed: 'This ability has already been used.',
				tooMuch: 'Too much %stat%.',
				notEnough: 'Not enough %stat%.',
				notMoveable: 'This creature cannot be moved.',
				passiveCycle: 'Switches between any usable abilities.',
				passiveUnavailable: 'No usable abilities to switch to.',
			},
			ui: {
				dash: {
					materializeOverload: 'Overload! Maximum number of units controlled',
					selectUnit: 'Please select an available unit from the left grid',
					lowPlasma: 'Low Plasma! Cannot materialize the selected unit',
					// plasmaCost :    String :    plasma cost of the unit to materialize
					materializeUnit: (plasmaCost: string) => {
						return 'Materialize unit at target location for ' + plasmaCost + ' plasma';
					},
					materializeUsed: 'Materialization has already been used this round',
					heavyDev: 'This unit is currently under heavy development',
				},
			},
		};

		/* Regex Test for triggers */
		this.triggers = {
			onStepIn: /\bonStepIn\b/,
			onStepOut: /\bonStepOut\b/,
			onReset: /\bonReset\b/,
			onStartPhase: /\bonStartPhase\b/,
			onEndPhase: /\bonEndPhase\b/,
			onMovement: /\bonMovement\b/,
			onUnderAttack: /\bonUnderAttack\b/,
			onDamage: /\bonDamage\b/,
			onHeal: /\bonHeal\b/,
			onAttack: /\bonAttack\b/,
			onCreatureMove: /\bonCreatureMove\b/,
			onCreatureDeath: /\bonCreatureDeath\b/,
			onCreatureSummon: /\bonCreatureSummon\b/,

			onStepIn_other: /\bonOtherStepIn\b/,
			onStepOut_other: /\bonOtherStepOut\b/,
			onReset_other: /\bonOtherReset\b/,
			onStartPhase_other: /\bonOtherStartPhase\b/,
			onEndPhase_other: /\bonOtherEndPhase\b/,
			onMovement_other: /\bonOtherMovement\b/,
			onAttack_other: /\bonOtherAttack\b/,
			onDamage_other: /\bonOtherDamage\b/,
			onHeal_other: /\bonOtherHeal\b/,
			onUnderAttack_other: /\bonOtherUnderAttack\b/,
			onCreatureMove_other: /\bonOtherCreatureMove\b/,
			onCreatureDeath_other: /\bonOtherCreatureDeath\b/,
			onCreatureSummon_other: /\bonOtherCreatureSummon\b/,

			onEffectAttach: /\bonEffectAttach\b/,
			onEffectAttach_other: /\bonOtherEffectAttach\b/,

			onStartOfRound: /\bonStartOfRound\b/,
			onQuery: /\bonQuery\b/,
			oncePerDamageChain: /\boncePerDamageChain\b/,
		};

		const signalChannels = ['ui', 'metaPowers', 'creature'];
		this.signals = this.setupSignalChannels(signalChannels);
	}

	dataLoaded(data: any): void {
		let dpcolor = ['blue', 'orange', 'green', 'red'];

		this.creatureData = data;

		data.forEach((creature: Creature) => {
			// @ts-ignore. Should we add playable property to creature?
			if (!creature.playable) {
				return;
			}

			let creatureId = creature.id,
				realm = creature.realm,
				level = creature.level,
				type = realm.toUpperCase() + level,
				name = creature.name,
				count: number,
				i: number;

			creature.type = type;

			// Load unit shouts
			this.soundsys.getSound(getUrl('units/shouts/' + name), 1000 + creatureId);

			// Load artwork
			this.getImage(getUrl('units/artwork/' + name));

			if (name == 'Dark Priest') {
				for (i = 0, count = dpcolor.length; i < count; i++) {
					this.Phaser.load.image(
						name + dpcolor[i] + '_cardboard',
						getUrl('units/cardboards/' + name + ' ' + dpcolor[i]),
					);
					this.getImage(getUrl('units/avatars/' + name + ' ' + dpcolor[i]));
				}
			} else {
				if (creature.drop) {
					this.Phaser.load.image(
						'drop_' + creature.drop.name,
						getUrl('drops/' + creature.drop.name),
					);
				}

				this.Phaser.load.image(name + '_cardboard', getUrl('units/cardboards/' + name));
				this.getImage(getUrl('units/avatars/' + name));
			}

			// For code compatibility
			this.availableCreatures[creatureId] = type;
		});

		this.Phaser.load.start();
	}

	/**
	 * loadGame(setupOpt) preload
	 *
	 * setupOpt :	Object :	Setup options from matchmaking menu
	 *
	 * Load all required game files
	 */

	loadGame(setupOpt: any, matchInitialized?: boolean, matchid?: any) {
		// Need to remove keydown listener before new game start
		// to prevent memory leak and mixing hotkeys between start screen and game
		$j(document).off('keydown');

		if (this.multiplayer && !matchid) {
			this.matchInitialized = matchInitialized;
		}
		if (matchid) {
			this.matchid = matchid;
		}

		let totalSoundEffects = this.soundEffects.length,
			i: number;
		this.gameState = 'loading';
		if (setupOpt) {
			this.gamelog.gameConfig = setupOpt;
			this.configData = setupOpt;
			$j.extend(this, setupOpt);
		}
		// console.log(this);
		this.startLoading();

		// Sounds
		this.musicPlayer = new MusicPlayer();
		this.soundLoaded = {};
		this.soundsys = new SoundSys({}, this);

		for (i = 0; i < totalSoundEffects; i++) {
			this.soundsys.getSound(getUrl(this.soundEffects[i]), this.availableMusic.length + i);
		}

		this.Phaser.load.onFileComplete.add(this.loadFinish, this);

		// Health
		let playerColors = ['red', 'blue', 'orange', 'green'];
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image('p' + i + '_health', getUrl('interface/rectangle_' + playerColors[i]));
			this.Phaser.load.image('p' + i + '_plasma', getUrl('interface/capsule_' + playerColors[i]));
			this.Phaser.load.image(
				'p' + i + '_frozen',
				getUrl('interface/rectangle_frozen_' + playerColors[i]),
			);
		}

		// Ability SFX
		this.Phaser.load.audio('MagmaSpawn0', getUrl('units/sfx/Infernal 0'));

		// Grid
		this.Phaser.load.image('hex', getUrl('interface/hex'));
		this.Phaser.load.image('hex_dashed', getUrl('interface/hex_dashed'));
		this.Phaser.load.image('hex_path', getUrl('interface/hex_path'));
		this.Phaser.load.image('cancel', getUrl('interface/cancel'));
		this.Phaser.load.image('input', getUrl('interface/hex_input'));
		for (i = 0; i < 4; i++) {
			this.Phaser.load.image('hex_p' + i, getUrl('interface/hex_glowing_' + playerColors[i]));
			this.Phaser.load.image('hex_hover_p' + i, getUrl('interface/hex_outline_' + playerColors[i]));
		}

		// Traps
		this.Phaser.load.image('trap_royal-seal', getUrl('units/sprites/Gumble - Royal Seal'));
		this.Phaser.load.image('trap_mud-bath', getUrl('units/sprites/Swine Thug - Mud Bath'));
		this.Phaser.load.image(
			'trap_scorched-ground',
			getUrl('units/sprites/Infernal - Scorched Ground'),
		);
		this.Phaser.load.image('trap_firewall', getUrl('units/sprites/Infernal - Scorched Ground'));
		this.Phaser.load.image('trap_poisonous-vine', getUrl('units/sprites/Impaler - Poisonous Vine'));

		// Effects
		this.Phaser.load.image('effects_fiery-touch', getUrl('units/sprites/Abolished - Fiery Touch'));
		this.Phaser.load.image(
			'effects_fissure-vent',
			getUrl('units/sprites/Infernal - Scorched Ground'),
		);
		this.Phaser.load.image(
			'effects_freezing-spit',
			getUrl('units/sprites/Snow Bunny - Freezing Spit'),
		);

		// Background
		this.Phaser.load.image('background', getUrl('locations/' + this.background_image + '/bg'));

		// Get JSON files
		this.dataLoaded(dataJson);
	}

	startLoading(): void {
		$j('#gameSetupContainer').hide();
		$j('#loader').removeClass('hide');
		$j('body').css('cursor', 'wait');
	}

	loadFinish(): void {
		let progress = this.Phaser.load.progress,
			progressWidth = progress + '%';

		$j('#barLoader .progress').css('width', progressWidth);

		if (progress == 100) {
			setTimeout(() => {
				this.gameState = 'loaded';
				$j('#combatwrapper').show();

				$j('body').css('cursor', 'default');

				// Do not call setup if we are not active.
				if (!this.preventSetup) {
					this.setup(this.playerMode);
				}
			}, 100);
		}
	}

	phaserUpdate(): void {
		if (this.gameState != 'playing') {
			return;
		}
	}

	phaserRender(): void {
		let count = this.creatures.length,
			i: number;

		for (i = 1; i < count; i++) {
			//G.Phaser.debug.renderSpriteBounds(G.creatures[i].sprite);
		}
	}

	/**
	 * Catch the browser being made inactive to prevent initial rendering bugs.
	 */
	onBlur(): void {
		this.preventSetup = true;
	}

	/**
	 * Catch the browser coming back into focus so we can render the game board.
	 */
	onFocus(): void {
		this.preventSetup = false;
		// If loaded, call maybeSetup with a tiny delay to prevent rendering issues.
		if (this.gameState == 'loaded') {
			setTimeout(() => {
				this.maybeSetup();
			}, 100);
		}
	}

	/**
	 * If no red flags, remove the loading bar and begin rendering the game.
	 */
	maybeSetup(): void {
		if (this.preventSetup) {
			return;
		}

		$j('#loader').addClass('hide');
		$j('body').css('cursor', 'default');
		this.setup(this.playerMode);
	}

	/**
	 * Setup(playerMode)
	 *
	 * playerMode :		Integer :	Ideally 2 or 4, number of players to configure
	 *
	 * Launch the game with the given number of player.
	 *
	 */
	setup(playerMode: number): void {
		let bg: Phaser.Sprite, i: number;

		// Phaser
		this.Phaser.scale.parentIsWindow = true;
		this.Phaser.scale.pageAlignHorizontally = true;
		this.Phaser.scale.pageAlignVertically = true;
		this.Phaser.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.Phaser.scale.fullScreenScaleMode = Phaser.ScaleManager.SHOW_ALL;
		this.Phaser.scale.refresh();
		this.Phaser.stage.disableVisibilityChange = true;

		if (!this.Phaser.device.desktop) {
			// @ts-ignore
			this.Phaser.stage.forcePortrait = true;
		}

		bg = this.Phaser.add.sprite(0, 0, 'background');
		bg.inputEnabled = true;
		bg.events.onInputUp.add((Sprite: any, Pointer: any) => {
			if (this.freezedInput || this.UI.dashopen) {
				return;
			}

			switch (Pointer.button) {
				case 0:
					// Left mouse button pressed
					break;
				case 1:
					// Middle mouse button pressed
					break;
				case 2:
					// Right mouse button pressed
					this.UI.showCreature(this.activeCreature.type, this.activeCreature.player.id, null);
					break;
			}
		}, this);

		// Reset global counters
		this.trapId = 0;
		this.effects = []; // this.effects = 0;
		this.dropId = 0;
		this.creatureIdCounter = 1;

		this.grid = new PhaserHexGrid({}, this); // Create Hexgrid

		this.startMatchTime = new Date();

		this.$combatFrame = $j('#combatframe');
		this.$combatFrame.show();

		// Remove loading screen
		$j('#matchMaking').hide();

		for (i = 0; i < playerMode; i++) {
			let player = new Player(i, this);
			this.players.push(player);

			// Initialize players' starting positions
			let pos = {};

			if (playerMode > 2) {
				// If 4 players
				switch (player.id) {
					case 0:
						pos = {
							x: 0,
							y: 1,
						};
						break;
					case 1:
						pos = {
							x: 15,
							y: 1,
						};
						break;
					case 2:
						pos = {
							x: 0,
							y: 7,
						};
						break;
					case 3:
						pos = {
							x: 15,
							y: 7,
						};
						break;
				}
			} else {
				// If 2 players
				switch (player.id) {
					case 0:
						pos = {
							x: 0,
							y: 4,
						};
						break;
					case 1:
						pos = {
							x: 14,
							y: 4,
						};
						break;
				}
			}

			player.summon('--', pos); // Summon Dark Priest
		}

		this.activeCreature = this.players[0].creatures[0]; // Prevent errors

		this.UI = new UI(this); // Create UI (not before because some functions require creatures to already exist)

		// DO NOT CALL LOG BEFORE UI CREATION
		this.gameState = 'playing';

		this.log('Welcome to Ancient Beast pre-Alpha');
		this.log('Setting up a ' + playerMode + ' player match');

		this.timeInterval = setInterval(() => {
			this.checkTime();
		}, this.checkTimeFrequency);

		this.nextCreature();

		this.resizeCombatFrame(); // Resize while the game is starting
		this.UI.resizeDash();

		let self = this;
		var resizeGame = function () {
			clearTimeout(self.windowResizeTimeout);
			self.windowResizeTimeout = setTimeout(() => {
				self.resizeCombatFrame();
				self.UI.resizeDash();
			}, 100);
		}.bind(this);

		// Handle resize events
		$j(window).on('resize', () => {
			// Throttle down to 1 event every 100ms of inactivity
			resizeGame();
		});

		// TODO: enable me later
		// this.soundsys.playMusic();
		if (this.gamelog.data) {
			// TODO: Remove the need for a timeout here by having a proper
			// "game is ready to play" event that can trigger log replays if
			// they are queued. -- ktiedt
			setTimeout(() => {
				this.gamelog.play.apply(this.gamelog);
			}, 1000);
		}

		this.matchInit();
	}

	async matchInit(): Promise<void> {
		if (this.multiplayer) {
			if (Object.keys(this.match).length === 0) {
				await this.connect.serverConnect(this.session);
				let match = new MatchI(this.connect, this, this.session);
				let gameplay = new Gameplay(this, match);
				match.gameplay = gameplay;
				this.gameplay = gameplay;
				this.match = match;

				// Only host
				if (this.matchInitialized) {
					let n = await this.match.matchCreate();

					console.log('created match', n);
					await match.matchMaker(n, this.configData);
				}
			}
			// Non-host
			if (this.matchid) {
				let n = await this.match.matchJoin(this.matchid);
				console.log('joined match', n);
			}
		}
	}

	async matchJoin(): Promise<void> {
		await this.matchInit();
		await this.match.matchMaker();
	}

	async updateLobby(): Promise<void> {
		if (this.matchInitialized) return;

		$j('.lobby-match-list').html('').addClass('refreshing');
		$j('#refreshMatchButton').addClass('disabled');
		$j('.lobby-loader').removeClass('hide');
		$j('.lobby-no-matches').addClass('hide');

		// Short delay to let the user know something has happened.
		await sleep(Phaser.Timer.SECOND * 2);

		$j('.lobby-match-list').removeClass('refreshing');
		$j('#refreshMatchButton').removeClass('disabled');
		$j('.lobby-loader').addClass('hide');

		if (!this.match.matchUsers.length) {
			$j('.lobby-no-matches').removeClass('hide');
			return;
		}

		this.match.matchUsers.forEach((v) => {
			const isAvailableMatch = v.string_properties && v.string_properties.match_id;

			if (!isAvailableMatch) {
				return;
			}

			let gameConfig = {
				background_image: v.string_properties.background_image,
				abilityUpgrades: v.numeric_properties.abilityUpgrades,
				creaLimitNbr: v.numeric_properties.creaLimitNbr,
				plasma_amount: v.numeric_properties.plasma_amount,
				playerMode: v.numeric_properties.playerMode,
				timePool: v.numeric_properties.timePool,
				turnTimePool: v.numeric_properties.turnTimePool,
				unitDrops: v.numeric_properties.unitDrops,
			};
			let turntimepool =
				v.numeric_properties.turnTimePool < 0 ? '∞' : v.numeric_properties.timePool;
			let timepool = v.numeric_properties.timePool < 0 ? '∞' : v.numeric_properties.timePool;
			let unitdrops = v.numeric_properties.unitDrops < 0 ? 'off' : 'on';
			let _matchBtn =
				$j(`<a class="user-match"><div class="avatar"></div><div class="user-match__col">
        Host: ${v.presence.username}<br />
        Player Mode: ${v.numeric_properties.playerMode}<br />
        Active Units: ${v.numeric_properties.creaLimitNbr}<br />
        Ability Upgrades: ${v.numeric_properties.abilityUpgrades}<br />
        </div><div class="user-match__col">
        Plasma Points: ${v.numeric_properties.plasma_amount}<br />
        Turn Time(seconds): ${turntimepool}<br />
        Turn Pools(minutes): ${timepool}<br />
        Unit Drops: ${unitdrops}<br /></div></a>
        `);
			_matchBtn.on('click', () => {
				$j('.lobby').hide();
				this.loadGame(gameConfig, false, v.string_properties.match_id);
			});
			$j('.lobby-match-list').append(_matchBtn);
		});
	}

	/**
	 * resizeCombatFrame()
	 *
	 * Resize the combat frame
	 */
	resizeCombatFrame(): void {
		if ($j('#cardwrapper').width() < $j('#card').width()) {
			$j('#cardwrapper_inner').width();
		}
	}

	/**
	 * nextRound()
	 *
	 * Replace the current queue with the next queue
	 */
	nextRound(): void {
		let totalCreatures = this.creatures.length,
			i: number;

		this.turn++;
		this.log('Round ' + this.turn, 'roundmarker', true);
		this.queue.nextRound();

		// Resets values
		for (i = 0; i < totalCreatures; i++) {
			if (this.creatures[i] instanceof Creature) {
				this.creatures[i].delayable = true;
				this.creatures[i].delayed = false;
			}
		}

		this.onStartOfRound();

		this.nextCreature();
	}

	/**
	 * nextCreature()
	 *
	 * Activate the next creature in queue
	 */
	nextCreature(): void {
		this.UI.closeDash();
		this.UI.btnToggleDash.changeState('normal');
		this.grid.xray(new PhaserHex(-1, -1, null, this)); // Clear Xray

		if (this.gameState == 'ended') {
			return;
		}

		this.stopTimer();
		// Delay
		setTimeout(() => {
			let interval = setInterval(() => {
				clearInterval(interval);

				let differentPlayer = false;

				if (this.queue.isCurrentEmpty()) {
					this.nextRound(); // Switch to the next Round
					return;
				} else {
					let next = this.queue.dequeue();
					if (this.activeCreature) {
						differentPlayer = this.activeCreature.player != next.player;
					} else {
						differentPlayer = true;
					}

					let last = this.activeCreature;
					this.activeCreature = next; // Set new activeCreature

					if (!last.dead) {
						last.updateHealth(); // Update health display due to active creature change
					}
				}

				if (this.activeCreature.player.hasLost) {
					this.nextCreature();
					return;
				}

				// Play heartbeat sound on other player's turn
				if (differentPlayer) {
					// TODO: enable me later
					// this.soundsys.playSound(this.soundLoaded[4], this.soundsys.heartbeatGainNode);
				}

				this.log('Active Creature : %CreatureName' + this.activeCreature.id + '%');
				this.activeCreature.activate();
				// console.log(this.activeCreature);

				// Show mini tutorial in the first round for each player
				if (this.turn == 1) {
					this.log('The active unit has a flashing hexagon');
					this.log('It uses a plasma field to protect itself');
					this.log('Its portrait is displayed in the upper left');
					this.log("Under the portrait are the unit's abilities");
					this.log('The ones with revealed icons are usable');
					this.log('Use the last one to materialize a creature');
					this.log('Making units drains your plasma points');
					this.log('Press the hourglass icon to skip the turn');
					this.log('%CreatureName' + this.activeCreature.id + '%, press here to toggle tutorial!');
				}

				// Updates UI to match new creature
				this.UI.updateActivebox();
				this.updateQueueDisplay();
				if (this.multiplayer && this.playersReady) {
					this.gameplay.updateTurn();
				} else {
					this.playersReady = true;
				}
			}, 50);
		}, 300);
	}

	updateQueueDisplay(excludeActiveCreature?: boolean): void {
		if (this.UI) {
			this.UI.updateQueueDisplay(excludeActiveCreature);
		}
	}

	/**
	 * log(obj)
	 *
	 * obj :	Any :	Any variable to display in console and game log
	 *
	 * Display obj in the console log and in the game log
	 */
	log(obj: any, htmlclass?: string, ifNoTimestamp = false): void {
		// Formating
		let stringConsole = obj,
			stringLog = obj,
			totalCreatures = this.creatures.length,
			creature: Creature,
			i: number;

		for (i = 0; i < totalCreatures; i++) {
			creature = this.creatures[i];

			if (creature instanceof Creature) {
				stringConsole = stringConsole.replace(
					'%CreatureName' + i + '%',
					creature.player.name + "'s " + creature.name,
				);
				stringLog = stringLog.replace(
					'%CreatureName' + i + '%',
					"<span class='" + creature.player.color + "'>" + creature.name + '</span>',
				);
			}
		}

		console.log(stringConsole);
		this.UI.chat.addMsg(stringLog, htmlclass, ifNoTimestamp);
	}

	togglePause(): void {
		if (this.freezedInput && this.pause) {
			this.pause = false;
			this.freezedInput = false;
			this.pauseTime += new Date().getTime() - this.pauseStartTime.getTime();
			$j('#pause').remove();
			this.startTimer();
		} else if (!this.pause && !this.freezedInput) {
			this.pause = true;
			this.freezedInput = true;
			this.pauseStartTime = new Date();
			this.stopTimer();
			$j('#ui').append('<div id="pause">Pause</div>');
		}
	}

	/**
	 * skipTurn()
	 *
	 * End turn for the current unit
	 */
	skipTurn(o?: any): void {
		// Removes temporary Creature from queue when Player skips turn
		// while choosing materialize location for Creature
		this.queue.removeTempCreature();

		// Send skip turn to server

		if (this.turnThrottle) {
			return;
		}

		o = $j.extend(
			{
				callback: function () {},
				noTooltip: false,
				tooltip: 'Skipped',
			},
			o,
		);

		this.turnThrottle = true;
		this.UI.btnSkipTurn.changeState('disabled');
		this.UI.btnDelay.changeState('disabled');
		this.UI.btnAudio.changeState('disabled');

		if (!o.noTooltip) {
			this.activeCreature.hint(o.tooltip, 'msg_effects');
		}

		setTimeout(() => {
			this.turnThrottle = false;
			this.UI.btnSkipTurn.changeState('normal');

			if (
				!this.activeCreature.hasWait &&
				this.activeCreature.delayable &&
				!this.queue.isCurrentEmpty()
			) {
				this.UI.btnDelay.changeState('normal');
			}

			o.callback.apply();
		}, 1000);

		this.activeCreature.facePlayerDefault();

		let skipTurn = new Date();
		let p = this.activeCreature.player;
		p.totalTimePool = p.totalTimePool - (skipTurn.getTime() - p.startTime.getTime());
		this.pauseTime = 0;
		this.activeCreature.deactivate(false);
		this.nextCreature();

		// Reset temporary Creature
		this.queue.tempCreature = {};
	}

	/**
	 * delayCreature()
	 *
	 * Delay the action turn of the current creature
	 */
	delayCreature(o?: any) {
		// Send skip turn to server
		if (this.multiplayer) {
			this.gameplay.delay();
		}

		if (this.turnThrottle) {
			return;
		}

		if (
			this.activeCreature.hasWait ||
			!this.activeCreature.delayable ||
			this.queue.isCurrentEmpty()
		) {
			return;
		}

		o = $j.extend(
			{
				callback: function () {},
			},
			o,
		);

		this.turnThrottle = true;
		this.UI.btnSkipTurn.changeState('disabled');
		this.UI.btnDelay.changeState('disabled');

		setTimeout(() => {
			this.turnThrottle = false;
			this.UI.btnSkipTurn.changeState('normal');
			if (
				!this.activeCreature.hasWait &&
				this.activeCreature.delayable &&
				!this.queue.isCurrentEmpty()
			) {
				this.UI.btnDelay.changeState('slideIn');
			}

			o.callback.apply();
		}, 1000);

		let skipTurn = new Date(),
			p = this.activeCreature.player;

		p.totalTimePool = p.totalTimePool - (skipTurn.getTime() - p.startTime.getTime());
		this.activeCreature.wait();
		this.nextCreature();
	}

	startTimer(): void {
		clearInterval(this.timeInterval);
		this.activeCreature.player.startTime = new Date(new Date().getTime() - this.pauseTime);
		this.checkTime();

		this.timeInterval = setInterval(() => {
			this.checkTime();
		}, this.checkTimeFrequency);
	}

	stopTimer(): void {
		clearInterval(this.timeInterval);
	}

	/**
	 * checkTime()
	 */
	checkTime(): void {
		let date = new Date(new Date().getTime() - this.pauseTime),
			p = this.activeCreature.player,
			alertTime = 5, // In seconds
			msgStyle = 'msg_effects',
			totalPlayers = this.playerMode,
			i: number;

		p.totalTimePool = Math.max(p.totalTimePool, 0); // Clamp

		// Check all timepools
		// Check is always true for infinite time
		let playerStillHaveTime = this.timePool > 0 ? false : true;
		for (i = 0; i < totalPlayers; i++) {
			// Each player
			playerStillHaveTime = this.players[i].totalTimePool > 0 || playerStillHaveTime;
		}

		// Check Match Time
		if (!playerStillHaveTime) {
			this.endGame();
			return;
		}

		this.UI.updateTimer();

		// Turn time and timepool not infinite
		if (this.timePool > 0 && this.turnTimePool > 0) {
			if (
				(date.getTime() - p.startTime.getTime()) / 1000 > this.turnTimePool ||
				p.totalTimePool - (+date - +p.startTime) < 0
			) {
				if (p.totalTimePool - (+date - +p.startTime) < 0) {
					p.deactivate(); // Only if timepool is empty
				}

				this.skipTurn();
				return;
			} else {
				if ((p.totalTimePool - (date.getTime() - p.startTime.getTime())) / 1000 < alertTime) {
					msgStyle = 'damage';
				}

				if (
					this.turnTimePool - (date.getTime() - p.startTime.getTime()) / 1000 < alertTime &&
					this.UI.dashopen
				) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(
							this.turnTimePool - (date.getTime() - p.startTime.getTime()) / 1000,
						).toString(),
						msgStyle,
					);
				}
			}
		} else if (this.turnTimePool > 0) {
			// Turn time is not infinite
			if ((date.getTime() - p.startTime.getTime()) / 1000 > this.turnTimePool) {
				this.skipTurn();
				return;
			} else {
				if (
					this.turnTimePool - (date.getTime() - p.startTime.getTime()) / 1000 < alertTime &&
					this.UI.dashopen
				) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(
							this.turnTimePool - (date.getTime() - p.startTime.getTime()) / 1000,
						).toString(),
						msgStyle,
					);
				}
			}
		} else if (this.timePool > 0) {
			// Timepool is not infinite
			if (p.totalTimePool - (date.getTime() - p.startTime.getTime()) < 0) {
				p.deactivate();
				this.skipTurn();
				return;
			} else {
				if (p.totalTimePool - (date.getTime() - p.startTime.getTime()) < alertTime) {
					msgStyle = 'damage';
				}

				if (
					this.turnTimePool - (date.getTime() - p.startTime.getTime()) / 1000 < alertTime &&
					this.UI.dashopen
				) {
					// Alert
					this.UI.btnToggleDash.changeState('glowing');
					this.activeCreature.hint(
						Math.ceil(
							this.turnTimePool - (date.getTime() - p.startTime.getTime()) / 1000,
						).toString(),
						msgStyle,
					);
				}
			}
		}
	}

	/**
	 * retrieveCreatureStats(type)
	 *
	 * type :	String :	Creature's type (ex: "0" for Dark Priest and "L2" for Magma Spawn)
	 *
	 * Query the database for creature stats
	 */
	retrieveCreatureStats(type: string) {
		let totalCreatures = this.creatureData.length,
			i: number;

		for (i = totalCreatures - 1; i >= 0; i--) {
			if (
				this.creatureData[i].type == type ||
				this.creatureData[i].realm + this.creatureData[i].level == type
			) {
				if (!this.creatureData[i].type) {
					// When type property is missing, create it using formula: concat(realm + level)
					this.creatureData[i].type = this.creatureData[i].realm + this.creatureData[i].level;
				}
				return this.creatureData[i];
			}
		}
	}

	triggerAbility(trigger: string, arg: any, retValue?: any) {
		let [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.abilities.forEach((ability: Ability) => {
			if (triggeredCreature.dead === true) {
				return;
			}

			if (this.triggers[trigger].test(ability.getTrigger())) {
				if (ability.require(required)) {
					retValue = ability.animation(required);
				}
			}
		});

		// For other creatures
		this.creatures.forEach((creature) => {
			if (triggeredCreature === creature || creature.dead === true) {
				return;
			}

			creature.abilities.forEach((ability: Ability) => {
				if (this.triggers[trigger + '_other'].test(ability.getTrigger())) {
					if (ability.require(required)) {
						retValue = ability.animation(required, triggeredCreature);
					}
				}
			});
		});

		return retValue;
	}

	triggerEffect(trigger: string, arg: any, retValue?: any): boolean {
		let [triggeredCreature, required] = arg;

		// For triggered creature
		triggeredCreature.effects.forEach((effect: Effect) => {
			if (triggeredCreature.dead === true) {
				return;
			}

			if (this.triggers[trigger].test(effect.trigger)) {
				retValue = effect.activate(required);
			}
		});

		// For other creatures
		this.creatures.forEach((creature) => {
			if (creature instanceof Creature) {
				if (triggeredCreature === creature || creature.dead === true) {
					return;
				}

				creature.effects.forEach((effect: Effect) => {
					if (this.triggers[trigger + '_other'].test(effect.trigger)) {
						retValue = effect.activate(required);
					}
				});
			}
		});

		return retValue;
	}

	triggerTrap(trigger: string, arg: any): void {
		let [triggeredCreature] = arg;

		triggeredCreature.hexagons.forEach((hex: Hex) => {
			hex.activateTrap(this.triggers[trigger], triggeredCreature);
		});
	}

	triggerDeleteEffect(trigger: string, creature: any): void {
		let effects = creature == 'all' ? this.effects : creature.effects,
			totalEffects = effects.length,
			i: number;

		for (i = 0; i < totalEffects; i++) {
			let effect = effects[i];

			if (
				effect.turnLifetime > 0 &&
				trigger === effect.deleteTrigger &&
				this.turn - effect.creationTurn >= effect.turnLifetime
			) {
				effect.deleteEffect();
				// Updates UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth();
				}

				i--;
				totalEffects--;
			}
		}
	}

	onStepIn(creature: Creature, hex: Hex, opts: any): void {
		this.triggerAbility('onStepIn', arguments);
		this.triggerEffect('onStepIn', arguments);
		// Check traps last; this is because traps adds effects triggered by
		// this event, which gets triggered again via G.triggerEffect. Otherwise
		// the trap's effects will be triggered twice.
		if (!opts || !opts.ignoreTraps) {
			this.triggerTrap('onStepIn', arguments);
		}
	}

	/**
	 * Be careful when using this trigger to apply damage as it can kill a creature
	 * before it has completed its movement, resulting in incorrect Drop placement
	 * and other bugs. Refer to Impaler Poisonous Vine ability for an example on how
	 * to delay damage until the end of movement.
	 *
	 * Removed individual args from definition because we are using the arguments variable.
	 */
	onStepOut(creature: Creature, hex: Hex, callback?: Function): void {
		this.triggerAbility('onStepOut', [creature, hex, callback]);
		this.triggerEffect('onStepOut', [creature, hex, callback]);
		// Check traps last; this is because traps add effects triggered by
		// this event, which gets triggered again via G.triggerEffect. Otherwise
		// the trap's effects will be triggered twice.
		this.triggerTrap('onStepOut', [creature, hex, callback]);
	}

	onReset(creature: Creature): void {
		this.triggerDeleteEffect('onReset', creature);
		this.triggerAbility('onReset', arguments);
		this.triggerEffect('onReset', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onStartPhase(creature: Creature, callback?: Function): void {
		let totalTraps = this.grid.traps.length,
			trap: Trap,
			i: number;

		for (i = 0; i < totalTraps; i++) {
			trap = this.grid.traps[i];

			if (trap === undefined) {
				continue;
			}

			if (trap.turnLifetime > 0) {
				if (this.turn - trap.creationTurn >= trap.turnLifetime) {
					if (trap.fullTurnLifetime) {
						if (trap.ownerCreature == this.activeCreature) {
							trap.destroy();
							i--;
						}
					} else {
						trap.destroy();
						i--;
					}
				}
			}
		}

		this.triggerDeleteEffect('onStartPhase', creature);
		this.triggerAbility('onStartPhase', [creature, callback]);
		this.triggerEffect('onStartPhase', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onEndPhase(creature: Creature, callback?: Function): void {
		this.triggerDeleteEffect('onEndPhase', creature);
		this.triggerAbility('onEndPhase', [creature, callback]);
		this.triggerEffect('onEndPhase', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onStartOfRound(creature?: Creature, callback?: Function): void {
		this.triggerDeleteEffect('onStartOfRound', 'all');
	}

	// Removed individual args from definition because we are using the arguments variable.
	onCreatureMove(creature: Creature, hex: Hex, callback?: Function): void {
		this.triggerAbility('onCreatureMove', [creature, hex, callback]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onCreatureDeath(creature: Creature, callback?: Function): void {
		this.triggerAbility('onCreatureDeath', [creature, callback]);
		this.triggerEffect('onCreatureDeath', [creature, creature]);

		// Looks for traps owned by this creature and destroy them
		this.grid.traps
			.filter(
				(trap) => trap.turnLifetime > 0 && trap.fullTurnLifetime && trap.ownerCreature == creature,
			)
			.forEach((trap) => trap.destroy());

		// Look for effects owned by this creature and destroy them if necessary
		this.effects
			// @ts-ignore. effect.deleteOnOwnerDeath is not declared.
			.filter((effect) => effect.owner === creature && effect.deleteOnOwnerDeath)
			.forEach((effect) => {
				effect.deleteEffect();
				// Update UI in case effect changes it
				if (effect.target) {
					effect.target.updateHealth();
				}
			});
	}

	onCreatureSummon(creature: any, callback: any): void {
		this.triggerAbility('onCreatureSummon', [creature, creature, callback]);
		this.triggerEffect('onCreatureSummon', [creature, creature]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onEffectAttach(creature: any, effect: any /*, callback */): void {
		this.triggerEffect('onEffectAttach', [creature, effect]);
	}

	onUnderAttack(creature: any, damage: any): any {
		this.triggerAbility('onUnderAttack', arguments, damage);
		this.triggerEffect('onUnderAttack', arguments, damage);
		return damage;
	}

	// Removed individual args from definition because we are using the arguments variable.
	onDamage(creature: Creature, damage: any): void {
		this.triggerAbility('onDamage', [creature, damage]);
		this.triggerEffect('onDamage', [creature, damage]);
	}

	// Removed individual args from definition because we are using the arguments variable.
	onHeal(creature: Creature, amount: number): void {
		this.triggerAbility('onHeal', [creature, amount]);
		this.triggerEffect('onHeal', [creature, amount]);
	}

	onAttack(creature: any, damage: any): void {
		this.triggerAbility('onAttack', arguments, damage);
		this.triggerEffect('onAttack', arguments, damage);
	}

	findCreature(o: any) {
		let ret = [],
			o2 = $j.extend(
				{
					team: -1, // No team
					type: '--', // Dark Priest
				},
				o,
			),
			creatures = this.creatures,
			totalCreatures = creatures.length,
			creature: Creature,
			match: boolean,
			wrongTeam: boolean,
			i: number;

		for (i = 0; i < totalCreatures; i++) {
			creature = creatures[i];

			if (creature instanceof Creature) {
				match = true;

				$j.each(o2, function (key, val) {
					if (key == 'team') {
						if (val == -1) {
							return;
						}

						if (val instanceof Array) {
							wrongTeam = true;
							if (val.indexOf(creature[key]) != -1) {
								wrongTeam = false;
							}

							if (wrongTeam) {
								match = false;
							}

							return;
						}
					}

					if (creature[key] != val) {
						match = false;
					}
				});

				if (match) {
					ret.push(creature);
				}
			}
		}

		return ret;
	}

	clearOncePerDamageChain(): void {
		let creatures = this.creatures,
			totalCreatures = creatures.length,
			totalEffects = this.effects.length,
			creature: Creature,
			totalAbilities: number,
			i: number,
			j: number;

		for (i = totalCreatures - 1; i >= 0; i--) {
			creature = this.creatures[i];

			if (creature instanceof Creature) {
				totalAbilities = creature.abilities.length;

				for (j = totalAbilities - 1; j >= 0; j--) {
					// @ts-ignore. Add triggeredThisChain to Ability?
					creature.abilities[j].triggeredThisChain = false;
				}
			}
		}

		for (i = 0; i < totalEffects; i++) {
			// @ts-ignore. Add triggeredThisChain to Ability?
			this.effects[i].triggeredThisChain = false;
		}
	}

	/* endGame()
	 *
	 * End the game and print stats
	 */
	endGame(): void {
		this.soundsys.stopMusic();
		this.endGameSound = this.soundsys.playSound(this.soundLoaded[5], this.soundsys.effectsGainNode);

		this.stopTimer();
		this.gameState = 'ended';

		//-------End bonuses--------//
		for (let i = 0; i < this.playerMode; i++) {
			// No fleeing
			if (!this.players[i].hasFled) {
				this.players[i].score.push({
					type: 'nofleeing',
				});
			}

			// Surviving Creature Bonus
			let immortal = true;
			for (let j = 0; j < this.players[i].creatures.length; j++) {
				if (!this.players[i].creatures[j].dead) {
					if (this.players[i].creatures[j].type != '--') {
						this.players[i].score.push({
							type: 'creaturebonus',
							creature: this.players[i].creatures[j],
						});
					} else {
						// Dark Priest Bonus
						this.players[i].score.push({
							type: 'darkpriestbonus',
						});
					}
				} else {
					immortal = false;
				}
			}

			// Immortal
			if (immortal && this.players[i].creatures.length > 1) {
				// At least 1 creature summoned
				this.players[i].score.push({
					type: 'immortal',
				});
			}
		}
		this.UI.endGame();
	}

	action(o: any, opt: any): void {
		let defaultOpt = {
			callback: function () {},
		};

		opt = $j.extend(defaultOpt, opt);

		this.clearOncePerDamageChain();
		switch (o.action) {
			case 'move':
				this.activeCreature.moveTo(this.grid.hexes[o.target.y][o.target.x], {
					callback: opt.callback,
				});
				break;
			case 'skip':
				this.skipTurn({
					callback: opt.callback,
				});
				break;
			case 'delay':
				this.delayCreature({
					callback: opt.callback,
				});
				break;
			case 'flee':
				this.activeCreature.player.flee({
					callback: opt.callback,
				});
				break;
			case 'ability': {
				let args = $j.makeArray(o.args[1]);

				if (o.target.type == 'hex') {
					args.unshift(this.grid.hexes[o.target.y][o.target.x]);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args,
					});
				}

				if (o.target.type == 'creature') {
					args.unshift(this.creatures[o.target.crea]);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args,
					});
				}

				if (o.target.type == 'array') {
					let array = o.target.array.map((item: Hex) => this.grid.hexes[item.y][item.x]);

					args.unshift(array);
					this.activeCreature.abilities[o.id].animation2({
						callback: opt.callback,
						arg: args,
					});
				}
				break;
			}
		}
	}

	getImage(url: string): void {
		let img = new Image();
		img.src = url;
		img.onload = function () {
			// No-op
		};
	}

	resetGame(): void {
		this.endGameSound.stop();
		this.UI.showGameSetup();
		this.stopTimer();
		this.players = [];
		this.creatures = [];
		this.effects = [];
		this.activeCreature = { id: 0 } as Creature;
		this.matchid = null;
		this.playersReady = false;
		this.preventSetup = false;
		this.animations = new PhaserAnimations(this);
		this.queue = new CreatureQueue(this);
		this.creatureIdCounter = 1;
		this.creatureData = [];
		this.pause = false;
		this.gameState = 'initialized';
		this.availableCreatures = [];
		this.animationQueue = [];
		this.configData = {};
		this.match = {} as MatchI;
		this.gameplay = {} as Gameplay;
		this.matchInitialized = false;
		this.firstKill = false;
		this.freezedInput = false;
		this.turnThrottle = false;
		this.turn = 0;

		this.gamelog.reset();
	}

	/**
	 * Setup signal channels based on a list of channel names.
	 *
	 * @example setupSignalChannels(['ui', 'game'])
	 * // ... another file
	 * this.game.signals.ui.add((message, payload) => console.log(message, payload), this);
	 *
	 * @see https://photonstorm.github.io/phaser-ce/Phaser.Signal.html
	 *
	 * @param {array} channels List of channel names.
	 * @returns {object} Phaser signals keyed by channel name.
	 */
	setupSignalChannels(channels: string[]): any {
		const signals = channels.reduce((acc, curr) => {
			return {
				...acc,
				[curr]: new Signal(),
			};
		}, {});

		return signals;
	}
}