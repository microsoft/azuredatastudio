/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as which from 'which';
import * as Constants from '../constants';

const localize = nls.loadMessageBundle();

export function getDropdownValue(dropdownValue: string | sqlops.CategoryValue): string {
	if (typeof(dropdownValue) === 'string') {
		return <string>dropdownValue;
	} else {
		return dropdownValue ? (<sqlops.CategoryValue>dropdownValue).name : undefined;
	}
}

export function getServerAddressFromName(connection: sqlops.ConnectionInfo | string): string {
	// Strip TDS port number from the server URI
	if ((<sqlops.ConnectionInfo>connection).options && (<sqlops.ConnectionInfo>connection).options['host']) {
		return (<sqlops.ConnectionInfo>connection).options['host'].split(',')[0].split(':')[0];
	} else if ((<sqlops.ConnectionInfo>connection).options && (<sqlops.ConnectionInfo>connection).options['server']) {
		return (<sqlops.ConnectionInfo>connection).options['server'].split(',')[0].split(':')[0];
	} else {
		return (<string>connection).split(',')[0].split(':')[0];
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
export function shellWhichResolving(cmd: string): Promise<string> {
	return new Promise<string>(resolve => {
		which(cmd, (err, foundPath) => {
			if (err) {
				resolve(undefined);
			} else {
				// NOTE: Using realpath b/c some system installs are symlinked from */bin
				resolve(fs.realpathSync(foundPath));
			}
		});
	});
}

export async function mkDir(dirPath: string, outputChannel?: vscode.OutputChannel): Promise<void> {
	if (!await fs.exists(dirPath)) {
		if (outputChannel) {
			outputChannel.appendLine(localize('mkdirOutputMsg', '... Creating {0}', dirPath));
		}
		await fs.ensureDir(dirPath);
	}
}

export function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

// COMMAND EXECUTION HELPERS ///////////////////////////////////////////////
export function executeBufferedCommand(cmd: string, options: childProcess.ExecOptions, outputChannel?: vscode.OutputChannel): Thenable<string> {
	return new Promise<string>((resolve, reject) => {
		if (outputChannel) {
			outputChannel.appendLine(`	> ${cmd}`);
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
			child.stdout.on('data', data => { outputDataChunk(data, outputChannel, '	stdout: '); });
			child.stderr.on('data', data => { outputDataChunk(data, outputChannel, '	stderr: '); });
		}
	});
}

export function executeExitCodeCommand(cmd: string, outputChannel?: vscode.OutputChannel): Thenable<number> {
	return new Promise<number>((resolve, reject) => {
		if (outputChannel) {
			outputChannel.appendLine(`	> ${cmd}`);
		}

		let child = childProcess.spawn(cmd, [], { shell: true, detached: false });

		// Add listeners for the process to exit
		child.on('error', reject);
		child.on('exit', (code: number) => { resolve(code); });

		// Add listeners to print stdout and stderr if an output channel was provided
		if (outputChannel) {
			child.stdout.on('data', data => { outputDataChunk(data, outputChannel, '	stdout: '); });
			child.stderr.on('data', data => { outputDataChunk(data, outputChannel, '	stderr: '); });
		}
	});
}

export function executeStreamedCommand(cmd: string, outputChannel?: vscode.OutputChannel): Thenable<void> {
	return new Promise<void>((resolve, reject) => {
		// Start the command
		if (outputChannel) {
			outputChannel.appendLine(`	> ${cmd}`);
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
			child.stdout.on('data', data => { outputDataChunk(data, outputChannel, '	stdout: '); });
			child.stderr.on('data', data => { outputDataChunk(data, outputChannel, '	stderr: '); });
		}
	});
}

export function isObjectExplorerContext(object: any): object is sqlops.ObjectExplorerContext {
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
