/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogger, LogLevel } from 'vscode-markdown-languageservice';

export class LogFunctionLogger implements ILogger {

	private static now(): string {
		const now = new Date();
		return String(now.getUTCHours()).padStart(2, '0')
			+ ':' + String(now.getMinutes()).padStart(2, '0')
			+ ':' + String(now.getUTCSeconds()).padStart(2, '0') + '.' + String(now.getMilliseconds()).padStart(3, '0');
	}

	private static data2String(data: any): string {
		if (data instanceof Error) {
			if (typeof data.stack === 'string') {
				return data.stack;
			}
			return data.message;
		}
		if (typeof data === 'string') {
			return data;
		}
		return JSON.stringify(data, undefined, 2);
	}

	constructor(
		private readonly _logFn: typeof console.log
	) { }


	public log(level: LogLevel, title: string, message: string, data?: any): void {
		this.appendLine(`[${level} ${LogFunctionLogger.now()}] ${title}: ${message}`);
		if (data) {
			this.appendLine(LogFunctionLogger.data2String(data));
		}
	}

	private appendLine(value: string): void {
		this._logFn(value);
	}
}

export const consoleLogger = new LogFunctionLogger(console.log);
