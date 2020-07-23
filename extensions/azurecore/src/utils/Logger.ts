/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class Logger {
	private static _piiLogging: boolean = false;

	static log(msg: any, ...vals: any[]) {
		const fullMessage = `${msg} - ${vals.map(v => JSON.stringify(v)).join(' - ')}`;
		console.log(fullMessage);
	}

	static error(msg: any, ...vals: any[]) {
		const fullMessage = `${msg} - ${vals.map(v => JSON.stringify(v)).join(' - ')}`;
		console.error(fullMessage);
	}

	static pii(msg: any, ...vals: any[]) {
		if (this.piiLogging) {
			Logger.log(msg, vals);
		}
	}

	public static set piiLogging(val: boolean) {
		this._piiLogging = val;
	}

	public static get piiLogging(): boolean {
		return this._piiLogging;
	}
}
