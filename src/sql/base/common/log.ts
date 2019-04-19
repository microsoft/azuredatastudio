/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function log(...args: any[]): void {
	console.log(`\x1b[90m[main ${new Date().toLocaleTimeString()}]\x1b[0m`, ...args);
}

export function warn(...args: any[]): void {
	console.warn(`\x1b[93m[main ${new Date().toLocaleTimeString()}]\x1b[0m`, ...args);
}

export function error(...args: any[]) {
	console.error(`\x1b[91m[main ${new Date().toLocaleTimeString()}]\x1b[0m`, ...args);
}
