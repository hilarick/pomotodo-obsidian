import { Editor, MarkdownView, Plugin, addIcon, moment } from 'obsidian';
import { PomoSettingTab, PomoSettings, DEFAULT_SETTINGS } from './settings';
import { Status, Timer } from './timer';
import { Pomotodoapi as PomotodoApi } from './pomotodoapi';
import { getDailyNoteFile } from './utils';


export default class PomoTimerPlugin extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement;
	timer: Timer;
	pomotodoApi: PomotodoApi;

	async onload() {

		console.log('Loading obsidian pomotodo');

		await this.loadSettings();
		this.addSettingTab(new PomoSettingTab(this.app, this));

		this.statusBar = this.addStatusBarItem();
		this.statusBar.addClass("statusbar-pomotodo");
		this.openLogFileOnClick();

		this.timer = new Timer(this);

		/*Adds icon to the left side bar which starts the pomo timer when clicked
			if no timer is currently running, and otherwise quits current timer*/
		if (this.settings.ribbonIcon === true) {
			addIcon("pomotodo", `t="1680691570019" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2830" data-darkreader-inline-fill="" width="100" height="100"><path d="M512 85.333333a426.666667 426.666667 0 0 1 426.666667 426.666667 426.666667 426.666667 0 0 1-426.666667 426.666667A426.666667 426.666667 0 0 1 85.333333 512 426.666667 426.666667 0 0 1 512 85.333333m-42.666667 618.666667l298.666667-298.666667-60.16-60.16L469.333333 583.253333l-131.84-131.413333L277.333333 512l192 192z" fill="#d81e06" p-id="2831" data-darkreader-inline-fill="" style="--darkreader-inline-fill:#783426;"></path>`);
			this.addRibbonIcon('alarm-plus', 'Start pomodoro', async () => {
				this.timer.onRibbonIconClick();
			});
		}

		/*Update status bar timer ever half second
			Ideally should change so only updating when in timer mode
			- regular conditional doesn't remove after quit, need unload*/
		this.registerInterval(window.setInterval(async () =>
			this.statusBar.setText(await this.timer.setStatusBarText()), 500));

		this.addCommand({
			id: 'start-satusbar-pomo',
			name: 'Start pomodoro',
			icon: 'play',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						this.timer.startTimer(Status.Pomo);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'pause-satusbar-pomo',
			name: 'Toggle timer pause',
			icon: 'pause',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.status !== Status.NoTimer) {
					if (!checking) {
						this.timer.togglePause();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'quit-satusbar-pomo',
			name: 'Quit timer',
			icon: 'quit',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf && this.timer.status !== Status.NoTimer) {
					if (!checking) {
						this.timer.quitTimer();
					}
					return true;
				}
				return false;
			}
		});

		this.pomotodoApi = new PomotodoApi(this.settings.pomotodokey);
		this.addCommand({
			id: 'parse-editor-todos',
			name: 'parse todos',
			icon: 'list-checks',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const lineCount = editor.lineCount();

				let lastTodoUUID: string = null;
				for (let i = 0; i < lineCount; i++) {
					const lineContent = editor.getLine(i);
					if (lineContent.startsWith("- [ ]") && !lineContent.contains('^')) {

						const uuidTodo = await this.pomotodoApi.createTodo(lineContent.substring(5));

						const lineContentWithBlock = lineContent.concat(` ^${uuidTodo}`);
						lastTodoUUID = uuidTodo;
						editor.setLine(i, lineContentWithBlock);
					}
					if (lineContent.startsWith("\t- [ ]") && !lineContent.contains('^')) {
						const uuidSubTodo = await this.pomotodoApi.createSubTodo(lineContent.substring(6), lastTodoUUID);

						const lineContentWithBlock = lineContent.concat(` ^${uuidSubTodo}`);
						editor.setLine(i, lineContentWithBlock);
					}

				}

			}
		});

	}

	//on click, open log file; from Day Planner https://github.com/lynchjames/obsidian-day-planner/blob/c8d4d33af294bde4586a943463e8042c0f6a3a2d/src/status-bar.ts#L53
	openLogFileOnClick() {
		this.statusBar.addClass("pomotodo-logging");

		this.statusBar.onClickEvent(async (ev: any) => {
			try {
				var file: string;
				// if (this.settings.logToDaily === true) {
				file = (await getDailyNoteFile()).path;
				// } else {
				// file = this.settings.logFile;
				// }

				this.app.workspace.openLinkText(file, '', false);
			} catch (error) {
				console.log(error);
			}
		});
	}

	onunload() {
		this.timer.quitTimer();
		console.log('Unloading status bar pomodoro timer');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}