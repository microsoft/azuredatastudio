/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { DataWorkspaceOutputChannel } from './constants';

export class Log {
	private output: vscode.OutputChannel;

	constructor() {
		this.output = vscode.window.createOutputChannel(DataWorkspaceOutputChannel);
	}

	error(message: string): void {
		this.output.appendLine(`[Error - ${this.now()}] ${message}`);
		console.error(message);
	}

	log(message: string): void {
		this.output.appendLine(`[Info - ${this.now()}] ${message}`);
	}

	private now(): string {
		const now = new Date();
		return this.padLeft(now.getUTCFullYear() + '', 2, '0')
			+ '-' + this.padLeft(now.getUTCMonth() + '', 2, '0')
			+ '-' + this.padLeft(now.getUTCDate() + '', 2, '0')
			+ ' ' + this.padLeft(now.getUTCHours() + '', 2, '0')
			+ ':' + this.padLeft(now.getMinutes() + '', 2, '0')
			+ ':' + this.padLeft(now.getUTCSeconds() + '', 2, '0') + '.' + now.getMilliseconds();
	}

	private padLeft(s: string, n: number, pad = ' ') {
		return pad.repeat(Math.max(0, n - s.length)) + s;
	}
}
const Logger = new Log();
export default Logger;
