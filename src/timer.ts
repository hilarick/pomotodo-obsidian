import { App, Notice, moment, TFile } from 'obsidian';

import { notificationUrl, whiteNoiseUrl } from './audio_urls';
import { WhiteNoise } from './white_noise';
import { PomoSettings } from './settings';
import PomoTimerPlugin from './main';
import { PomoTodoListModal } from './list_modal';

const electron = require("electron");

const MILLISECS_IN_MINUTE = 60 * 1000;

export const enum Status {
	Pomo,
	ShortBreak,
	LongBreak,
	NoTimer
}


export class Timer {
	app: App;
	plugin: PomoTimerPlugin;
	settings: PomoSettings;
	startTime: moment.Moment; /*when currently running timer started*/
	endTime: moment.Moment;   /*when currently running timer will end if not paused*/
	lastStartTime: moment.Moment;
	status: Status;
	pausedTime: number;  /*time left on paused timer, in milliseconds*/
	paused: boolean;
	autoPaused: boolean;
	pomosSinceStart: number;
	cyclesSinceLastAutoStop: number;
	activeNote: TFile;
	whiteNoisePlayer: WhiteNoise;
	pomoUuid: string;

	constructor(plugin: PomoTimerPlugin) {
		this.app = plugin.app;
		this.plugin = plugin;
		this.settings = plugin.settings;
		this.status = Status.NoTimer;
		this.paused = false;
		this.pomosSinceStart = 0;
		this.cyclesSinceLastAutoStop = 0;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer = new WhiteNoise(plugin, whiteNoiseUrl);
		}
	}

	onRibbonIconClick() {
		if (this.status === Status.NoTimer) {  //if starting from not having a timer running/paused
			this.startTimer(Status.Pomo);
		} else { //if timer exists, pause or unpause
			this.togglePause();
		}
	}

	/*Set status bar to remaining time or empty string if no timer is running*/
	//handling switching logic here, should spin out
	async setStatusBarText(): Promise<string> {
		if (this.status !== Status.NoTimer) {
			let timer_type_symbol = "";
			if (this.settings.emoji === true) {
				timer_type_symbol = "🏖️ ";
				if (this.status === Status.Pomo) {
					timer_type_symbol = "🍅 ";
				}
			}

			if (this.paused === true) {
				return timer_type_symbol + millisecsToString(this.pausedTime); //just show the paused time
			} else if (moment().isSameOrAfter(this.endTime)) {
				await this.handleTimerEnd();
			}

			return timer_type_symbol + millisecsToString(this.getCountdown()); //return display value
		} else {
			return ""; //fixes TypeError: failed to execute 'appendChild' on 'Node https://github.com/kzhovn/statusbar-pomotodo-obsidian/issues/4
		}
	}

	async handleTimerEnd() {
		if (this.status === Status.Pomo) { //completed another pomo
			this.pomosSinceStart += 1;

			this.whiteNoisePlayer.stopWhiteNoise();
			let pomolistmodal = new PomoTodoListModal(this.app, this.startTime.format("YYYY-MM-DD HH:mm:ss"), this.getTotalModeMillisecs() / 1000, this.settings.pomotodokey);
			pomolistmodal.setPlaceholder("What have you done last pomo?");
			pomolistmodal.open();
		} else if (this.status === Status.ShortBreak || this.status === Status.LongBreak) {
			this.cyclesSinceLastAutoStop += 1;
		}

		//switch mode
		if (this.settings.notificationSound === true) { //play sound end of timer
			playNotification();
		}
		if (this.settings.useSystemNotification === true) { //show system notification end of timer
			showSystemNotification(this.status, this.settings.emoji);
		}

		if (this.settings.autostartTimer === false && this.settings.numAutoCycles <= this.cyclesSinceLastAutoStop) { //if autostart disabled, pause and allow user to start manually
			this.setupTimer();
			this.autoPaused = true;
			this.paused = true;
			this.pausedTime = this.getTotalModeMillisecs();
			this.cyclesSinceLastAutoStop = 0;
		} else {
			this.startTimer();
		}
	}

	async quitTimer(): Promise<void> {
		this.status = Status.NoTimer;
		this.startTime = moment(0);
		this.endTime = moment(0);
		this.paused = false;
		this.pomosSinceStart = 0;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.stopWhiteNoise();
		}

		await this.plugin.loadSettings(); //why am I loading settings on quit? to ensure that when I restart everything is correct? seems weird
	}

	pauseTimer(): void {
		this.paused = true;
		this.pausedTime = this.getCountdown();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.stopWhiteNoise();
		}
	}

	togglePause() {
		if (this.paused === true) {
			this.restartTimer();
		} else if (this.status !== Status.NoTimer) { //if some timer running
			this.pauseTimer();
			new Notice("Timer paused.")
		}
	}

	restartTimer(): void {

		this.setStartAndEndTime(this.pausedTime);
		this.modeRestartingNotification();
		this.paused = false;

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	async startTimer(mode: Status = null): Promise<void> {
		this.setupTimer(mode);
		this.paused = false; //do I need this?

		this.modeStartingNotification();

		if (this.settings.whiteNoise === true) {
			this.whiteNoisePlayer.whiteNoise();
		}
	}

	private setupTimer(mode: Status = null) {
		if (mode === null) { //no arg -> start next mode in cycle
			if (this.status === Status.Pomo) {
				if (this.pomosSinceStart % this.settings.longBreakInterval === 0) {
					this.status = Status.LongBreak;
				} else {
					this.status = Status.ShortBreak;
				}
			} else { //short break, long break, or no timer
				this.status = Status.Pomo;
			}
		} else { //starting a specific mode passed to func
			this.status = mode;
		}

		this.setStartAndEndTime(this.getTotalModeMillisecs());
	}

	setStartAndEndTime(millisecsLeft: number): void {
		this.lastStartTime = this.startTime;
		this.startTime = moment(); //start time to current time

		if (!this.startTime.isSame(this.lastStartTime, 'day')) {
			this.pomosSinceStart = 0;
		}

		this.endTime = moment().add(millisecsLeft, 'milliseconds');
	}

	/*Return milliseconds left until end of timer*/
	getCountdown(): number {
		let endTimeClone = this.endTime.clone(); //rewrite with freeze?
		return endTimeClone.diff(moment());
	}

	getTotalModeMillisecs(): number {
		switch (this.status) {
			case Status.Pomo: {
				return this.settings.pomo * MILLISECS_IN_MINUTE;
			}
			case Status.ShortBreak: {
				return this.settings.shortBreak * MILLISECS_IN_MINUTE;
			}
			case Status.LongBreak: {
				return this.settings.longBreak * MILLISECS_IN_MINUTE;
			}
			case Status.NoTimer: {
				throw new Error("Mode NoTimer does not have an associated time value");
			}
		}
	}



	/**************  Notifications  **************/
	/*Sends notification corresponding to whatever the mode is at the moment it's called*/
	modeStartingNotification(): void {
		let time = this.getTotalModeMillisecs();
		let unit: string;

		if (time >= MILLISECS_IN_MINUTE) { /*display in minutes*/
			time = Math.floor(time / MILLISECS_IN_MINUTE);
			unit = 'minute';
		} else { /*less than a minute, display in seconds*/
			time = Math.floor(time / 1000); //convert to secs
			unit = 'second';
		}

		switch (this.status) {
			case (Status.Pomo): {
				new Notice(`Starting ${time} ${unit} pomodoro.`);
				break;
			}
			case (Status.ShortBreak):
			case (Status.LongBreak): {
				new Notice(`Starting ${time} ${unit} break.`);
				break;
			}
			case (Status.NoTimer): {
				new Notice('Quitting pomodoro timer.');
				break;
			}
		}
	}

	modeRestartingNotification(): void {
		switch (this.status) {
			case (Status.Pomo): {
				new Notice(`Restarting pomodoro.`);
				break;
			}
			case (Status.ShortBreak):
			case (Status.LongBreak): {
				new Notice(`Restarting break.`);
				break;
			}
		}
	}
}

/*Returns [HH:]mm:ss left on the current timer*/
function millisecsToString(millisecs: number): string {
	let formattedCountDown: string;

	if (millisecs >= 60 * 60 * 1000) { /* >= 1 hour*/
		formattedCountDown = moment.utc(millisecs).format('HH:mm:ss');
	} else {
		formattedCountDown = moment.utc(millisecs).format('mm:ss');
	}

	return formattedCountDown.toString();
}

function playNotification(): void {
	const audio = new Audio(notificationUrl);
	audio.play();
}

function showSystemNotification(mode: Status, useEmoji: boolean): void {
	let text = "";
	switch (mode) {
		case (Status.Pomo): {
			let emoji = useEmoji ? "🏖" : ""
			text = `End of the pomodoro, time to take a break ${emoji}`;
			break;
		}
		case (Status.ShortBreak):
		case (Status.LongBreak): {
			let emoji = useEmoji ? "🍅" : ""
			text = `End of the break, time for the next pomodoro ${emoji}`;
			break;
		}
		case (Status.NoTimer): {
			// no system notification needed
			return;
		}
	}
	let emoji = useEmoji ? "🍅" : ""
	let title = `Obsidian Pomodoro ${emoji}`;

	// Show system notification
	const Notification = (electron as any).remote.Notification;
	const n = new Notification({
		title: title,
		body: text,
		silent: true
	});
	n.on("click", () => {
		n.close();
	});
	n.show();
	setTimeout(() => { n.close(); }, 5000);
}








