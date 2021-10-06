/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

class LoggerImpl {
	private _output: vscode.OutputChannel;

	constructor() {
	}

	initialize(channel: vscode.OutputChannel) {
		this._output = channel;
	}

	log(msg: string): void {
		this._output.appendLine(`[${new Date().toISOString()}] ${msg}`);
	}

	show(): void {
		this._output.show(true);
	}
}

const Logger = new LoggerImpl();
export default Logger;
