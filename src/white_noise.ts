import PomoTimerPlugin from './main';
import { Status } from './timer'

export class WhiteNoise {
	plugin: PomoTimerPlugin;
	whiteNoisePlayer: HTMLAudioElement;

	constructor(plugin: PomoTimerPlugin, whiteNoiseUrl: string) {
		this.plugin = plugin;
		this.whiteNoisePlayer = new Audio(whiteNoiseUrl);
		this.whiteNoisePlayer.loop = true;
	}

	stopWhiteNoise() {
		this.whiteNoisePlayer.pause();
		this.whiteNoisePlayer.currentTime = 0;
	}

	whiteNoise() {
		if (this.plugin.timer.status === Status.Pomo && this.plugin.timer.paused === false) {
			this.whiteNoisePlayer.play();
		} else {
			this.stopWhiteNoise();
		}
	}
}
