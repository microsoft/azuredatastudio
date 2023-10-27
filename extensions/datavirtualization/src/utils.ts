/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as childProcess from 'child_process';
import { ExecOptions } from 'child_process';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as azdata from 'azdata';
import * as vscode from 'vscode';

import * as Constants from './constants';
import { CategoryValue } from 'azdata';

const localize = nls.loadMessageBundle();

export function getDropdownValue(dropdownValue: string | CategoryValue): string {
	if (typeof (dropdownValue) === 'string') {
		return <string>dropdownValue;
	} else {
		return dropdownValue ? (<CategoryValue>dropdownValue).name : undefined;
	}
}

/**
 * Helper to log messages to the developer console if enabled
 * @param msg Message to log to the console
 */
export function logDebug(msg: any): void {
	let config = vscode.workspace.getConfiguration(Constants.extensionConfigSectionName);
	let logDebugInfo = config[Constants.configLogDebugInfo];
	if (logDebugInfo === true) {
		let currentTime = new Date().toLocaleTimeString();
		let outputMsg = '[' + currentTime + ']: ' + msg ? msg.toString() : '';
		console.log(outputMsg);
	}
}

export function getKnoxUrl(host: string, port: string): string {
	return `https://${host}:${port}/gateway`;
}

export function getLivyUrl(serverName: string, port: string): string {
	return this.getKnoxUrl(serverName, port) + '/default/livy/v1/';
}

export function getTemplatePath(extensionPath: string, templateName: string): string {
	return path.join(extensionPath, 'resources', templateName);
}

export function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

// COMMAND EXECUTION HELPERS ///////////////////////////////////////////////
export function executeBufferedCommand(cmd: string, options: ExecOptions, outputChannel?: vscode.OutputChannel): Thenable<string> {
	return new Promise<string>((resolve, reject) => {
		if (outputChannel) {
			outputChannel.appendLine(`    > ${cmd}`);
		}

		let child = childProcess.exec(cmd, options, (err, stdout) => {
			if (err) {
				reject(err);
			} else {
				resolve(stdout);
			}
		});

		// Add listeners to print stdout and stderr if an output channel was provided
		if (outputChannel) {
			child.stdout.on('data', data => { outputDataChunk(data, outputChannel, '    stdout: '); });
			child.stderr.on('data', data => { outputDataChunk(data, outputChannel, '    stderr: '); });
		}
	});
}

export function executeExitCodeCommand(cmd: string, outputChannel?: vscode.OutputChannel): Thenable<number> {
	return new Promise<number>((resolve, reject) => {
		if (outputChannel) {
			outputChannel.appendLine(`    > ${cmd}`);
		}

		let child = childProcess.spawn(cmd, [], { shell: true, detached: false });

		// Add listeners for the process to exit
		child.on('error', reject);
		child.on('exit', (code: number) => { resolve(code); });

		// Add listeners to print stdout and stderr if an output channel was provided
		if (outputChannel) {
			child.stdout.on('data', data => { outputDataChunk(data, outputChannel, '    stdout: '); });
			child.stderr.on('data', data => { outputDataChunk(data, outputChannel, '    stderr: '); });
		}
	});
}

export function executeStreamedCommand(cmd: string, outputChannel?: vscode.OutputChannel): Thenable<void> {
	return new Promise<void>((resolve, reject) => {
		// Start the command
		if (outputChannel) {
			outputChannel.appendLine(`    > ${cmd}`);
		}
		let child = childProcess.spawn(cmd, [], { shell: true, detached: false });

		// Add listeners to resolve/reject the promise on exit
		child.on('error', reject);
		child.on('exit', (code: number) => {
			if (code === 0) {
				resolve();
			} else {
				reject(localize('executeCommandProcessExited', 'Process exited with code {0}', code));
			}
		});

		// Add listeners to print stdout and stderr if an output channel was provided
		if (outputChannel) {
			child.stdout.on('data', data => { outputDataChunk(data, outputChannel, '    stdout: '); });
			child.stderr.on('data', data => { outputDataChunk(data, outputChannel, '    stderr: '); });
		}
	});
}

export function isObjectExplorerContext(object: any): object is azdata.ObjectExplorerContext {
	return 'connectionProfile' in object && 'isConnectionNode' in object;
}

export function getUserHome(): string {
	return process.env.HOME || process.env.USERPROFILE;
}

export enum Platform {
	Mac,
	Linux,
	Windows,
	Others
}

export function getOSPlatform(): Platform {
	switch (process.platform) {
		case 'win32':
			return Platform.Windows;
		case 'darwin':
			return Platform.Mac;
		case 'linux':
			return Platform.Linux;
		default:
			return Platform.Others;
	}
}

export function getOSPlatformId(): string {
	var platformId = undefined;
	switch (process.platform) {
		case 'win32':
			platformId = 'win-x64';
			break;
		case 'darwin':
			platformId = 'osx';
			break;
		default:
			platformId = 'linux-x64';
			break;
	}
	return platformId;
}

// PRIVATE HELPERS /////////////////////////////////////////////////////////
function outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
	data.toString().split(/\r?\n/)
		.forEach(line => {
			outputChannel.appendLine(header + line);
		});
}

export function clone<T>(obj: T): T {
	if (!obj || typeof obj !== 'object') {
		return obj;
	}
	if (obj instanceof RegExp) {
		// See https://github.com/Microsoft/TypeScript/issues/10990
		return obj as any;
	}
	const result = (Array.isArray(obj)) ? <any>[] : <any>{};
	Object.keys(obj).forEach(key => {
		if (obj[key] && typeof obj[key] === 'object') {
			result[key] = clone(obj[key]);
		} else {
			result[key] = obj[key];
		}
	});
	return result;
}

export function isValidNumber(maybeNumber: any) {
	return maybeNumber !== undefined
		&& maybeNumber !== null
		&& maybeNumber !== ''
		&& !isNaN(Number(maybeNumber.toString()));
}

/**
 * Removes the leading and trailing slashes from the pathName portion of a URL.
 * @param pathName Path name portion of a URL.
 * @returns Cleaned pathName string, or empty string if pathName is undefined.
 */
export function stripUrlPathSlashes(pathName: string): string {
	if (!pathName) {
		return '';
	}

	// Exclude empty trailing slashes
	const lastCharIndex = pathName.length - 1;
	if (pathName.length > 0 && pathName[lastCharIndex] === '/') {
		let parseEndIndex = 0;
		for (let i = lastCharIndex; i >= 0; --i) {
			if (pathName[i] !== '/') {
				parseEndIndex = i + 1;
				break;
			}
		}
		pathName = pathName.slice(0, parseEndIndex);
	}

	// Strip leading slash
	if (pathName.length > 0 && pathName[0] === '/') {
		pathName = pathName.slice(1);
	}

	return pathName;
}
