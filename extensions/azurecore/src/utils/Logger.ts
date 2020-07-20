/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class Logger {
	private static _piiLogging: boolean = false;

	static log(msg: any, ...vals: any[]) {
		if (vals && vals.length > 0) {
			return console.log(msg, vals);
		}
		console.log(msg);
	}

	static error(msg: any, ...vals: any[]) {
		if (vals && vals.length > 0) {
			return console.error(msg, vals);
		}
		console.error(msg);
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
