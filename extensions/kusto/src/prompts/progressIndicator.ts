'use strict';

// This code is originally from https://github.com/DonJayamanne/bowerVSCode
// License: https://github.com/DonJayamanne/bowerVSCode/blob/master/LICENSE

import { window, StatusBarItem, StatusBarAlignment } from 'vscode';

export default class ProgressIndicator {

	private _statusBarItem: StatusBarItem;

	constructor() {
		this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
	}

	private _tasks: string[] = [];
	public beginTask(task: string): void {
		this._tasks.push(task);
		this.displayProgressIndicator();
	}

	public endTask(task: string): void {
		if (this._tasks.length > 0) {
			this._tasks.pop();
		}

		this.setMessage();
	}

	private setMessage(): void {
		if (this._tasks.length === 0) {
			this._statusBarItem.text = '';
			this.hideProgressIndicator();
			return;
		}

		this._statusBarItem.text = this._tasks[this._tasks.length - 1];
		this._statusBarItem.show();
	}

	private _interval: any;
	private displayProgressIndicator(): void {
		this.setMessage();
		this.hideProgressIndicator();
		this._interval = setInterval(() => this.onDisplayProgressIndicator(), 100);
	}
	private hideProgressIndicator(): void {
		if (this._interval) {
			clearInterval(this._interval);
			this._interval = undefined;
		}
		this.ProgressCounter = 0;
	}

	private ProgressText = ['|', '/', '-', '\\', '|', '/', '-', '\\'];
	private ProgressCounter = 0;
	private onDisplayProgressIndicator(): void {
		if (this._tasks.length === 0) {
			return;
		}

		let txt = this.ProgressText[this.ProgressCounter];
		this._statusBarItem.text = this._tasks[this._tasks.length - 1] + ' ' + txt;
		this.ProgressCounter++;

		if (this.ProgressCounter >= this.ProgressText.length - 1) {
			this.ProgressCounter = 0;
		}
	}
}
