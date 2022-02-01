/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AdapterLogger, DEFAULT_LOG_LEVEL, ILogger, LogLevel } from 'vs/platform/log/common/log';

export interface IAutomatedWindow {
	codeAutomationLog(type: string, args: any[]): void;
	codeAutomationExit(code: number): void;
}

function logLevelToString(level: LogLevel): string {
	switch (level) {
		case LogLevel.Trace: return 'trace';
		case LogLevel.Debug: return 'debug';
		case LogLevel.Info: return 'info';
		case LogLevel.Warning: return 'warn';
		case LogLevel.Error: return 'error';
		case LogLevel.Critical: return 'error';
	}
	return 'info';
}

/**
 * A logger that is used when VSCode is running in the web with
 * an automation such as playwright. We expect a global codeAutomationLog
 * to be defined that we can use to log to.
 */
export class ConsoleLogInAutomationLogger extends AdapterLogger implements ILogger {

	declare codeAutomationLog: any;

	constructor(logLevel: LogLevel = DEFAULT_LOG_LEVEL) {
		super({ log: (level, args) => this.consoleLog(logLevelToString(level), args) }, logLevel);
	}

	private consoleLog(type: string, args: any[]): void {
		const automatedWindow = window as unknown as IAutomatedWindow;
		if (typeof automatedWindow.codeAutomationLog === 'function') {
			automatedWindow.codeAutomationLog(type, args);
		}
	}
}
