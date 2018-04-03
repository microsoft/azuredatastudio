/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import vscode = require('vscode');

export default class ServiceStatus implements vscode.Disposable {

	private _progressTimerId: NodeJS.Timer;

	private _statusBarItem: vscode.StatusBarItem = undefined;

	private durationStatusInMs: number = 1500;

	// These need localization
	private _serviceStartingMessage: string = `Starting ${this._serviceName}`;
	private _serviceStartedMessage: string = `${this._serviceName} started`;

	constructor(private _serviceName: string) {
		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	}

	public showServiceLoading(): Promise<void> {
		return this === undefined ?
			Promise.resolve() :
			Promise.resolve(this.updateStatusView(this._serviceStartingMessage, true));
	}

	public showServiceLoaded(): Promise<void> {
		return this === undefined ?
			Promise.resolve() :
			Promise.resolve(this.updateStatusView(this._serviceStartedMessage, false, this.durationStatusInMs));
	}

	//TODO: This can be merged with the serverStatus code
	private showProgress(statusText: string): void {
		let index: number = 0;
		let progressTicks: string[] = ['.', '..', '...', '....'];

		this._progressTimerId = setInterval(() => {
			index = (index + 1) % progressTicks.length;
			let progressTick = progressTicks[index];
			if (this._statusBarItem.text !== this._serviceStartedMessage) {
				this._statusBarItem.text = statusText + ' ' + progressTick;
				this._statusBarItem.show();
			}
		}, 400);
	}

	private updateStatusView(message: string, showAsProgress: boolean = false, disposeAfter: number = -1): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (showAsProgress) {
				this.showProgress(message);
			}
			else {
				this._statusBarItem.text = message;
				this._statusBarItem.show();
				if (this._progressTimerId !== undefined) {
					clearInterval(this._progressTimerId);
				}
			}
			if (disposeAfter !== -1) {
				setInterval(() => {
					this._statusBarItem.hide();
				}, disposeAfter);
			}
			resolve();
		});
	}

	dispose(): void {
		if (this._progressTimerId !== undefined) {
			clearInterval(this._progressTimerId);
		}
		this._statusBarItem.dispose();
	}

}
