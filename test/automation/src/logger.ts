/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { appendFileSync, writeFileSync } from 'fs';
import { format } from 'util';
import { EOL } from 'os';

export interface Logger {
	log(message: string, ...args: any[]): void;
	time(label: string): void;
	timeEnd(label: string): void;
}

export class ConsoleLogger implements Logger {

	log(message: string, ...args: any[]): void {
		console.log('**', message, ...args);
	}

	time(label: string): void {
		console.time(label);
	}

	timeEnd(label: string): void {
		console.timeEnd(label);
	}
}

export class FileLogger implements Logger {

	constructor(private path: string) {
		writeFileSync(path, '');
	}

	log(message: string, ...args: any[]): void {
		const date = new Date().toISOString();
		appendFileSync(this.path, `[${date}] ${format(message, ...args)}${EOL}`);
	}

	time(label: string): void {
	}

	timeEnd(label: string): void {
	}
}

export class MultiLogger implements Logger {

	constructor(private loggers: Logger[]) { }

	log(message: string, ...args: any[]): void {
		for (const logger of this.loggers) {
			logger.log(message, ...args);
		}
	}

	time(label: string): void {
		for (const logger of this.loggers) {
			logger.time(label);
		}
	}

	timeEnd(label: string): void {
		for (const logger of this.loggers) {
			logger.timeEnd(label);
		}
	}
}
