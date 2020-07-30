/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as crypto from 'crypto';
import { notebookLanguages } from './constants';

const localize = nls.loadMessageBundle();

export function getKnoxUrl(host: string, port: string): string {
	return `https://${host}:${port}/gateway`;
}

export function getLivyUrl(serverName: string, port: string): string {
	return this.getKnoxUrl(serverName, port) + '/default/livy/v1/';
}

export async function mkDir(dirPath: string, outputChannel?: vscode.OutputChannel): Promise<void> {
	if (!await fs.pathExists(dirPath)) {
		if (outputChannel) {
			outputChannel.appendLine(localize('mkdirOutputMsg', "... Creating {0}", dirPath));
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

export function executeStreamedCommand(cmd: string, options: childProcess.SpawnOptions, outputChannel?: vscode.OutputChannel): Thenable<void> {
	return new Promise<void>((resolve, reject) => {
		// Start the command
		if (outputChannel) {
			outputChannel.appendLine(`    > ${cmd}`);
		}
		options.shell = true;
		options.detached = false;
		let child = childProcess.spawn(cmd, [], options);

		// Add listeners to resolve/reject the promise on exit
		child.on('error', err => {
			reject(err);
		});

		let stdErrLog = '';
		child.on('exit', (code: number) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(localize('executeCommandProcessExited', "Process exited with error code: {0}. StdErr Output: {1}", code, stdErrLog)));
			}
		});

		// Add listeners to print stdout and stderr if an output channel was provided
		if (outputChannel) {
			child.stdout.on('data', data => { outputDataChunk(data, outputChannel, '    stdout: '); });
		}
		child.stderr.on('data', data => {
			if (outputChannel) {
				outputDataChunk(data, outputChannel, '    stderr: ');
			}
			stdErrLog += data.toString();
		});
	});
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

interface RawEndpoint {
	serviceName: string;
	description?: string;
	endpoint?: string;
	protocol?: string;
	ipAddress?: string;
	port?: number;
}

export interface IEndpoint {
	serviceName: string;
	description: string;
	endpoint: string;
	protocol: string;
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
	let platformId = undefined;
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

/**
 * Compares two version strings to see which is greater.
 * @param first First version string to compare.
 * @param second Second version string to compare.
 * @returns 1 if the first version is greater, -1 if it's less, and 0 otherwise.
 */
export function comparePackageVersions(first: string, second: string): number {
	let firstVersion = first.split('.').map(numStr => Number.parseInt(numStr));
	let secondVersion = second.split('.').map(numStr => Number.parseInt(numStr));

	// If versions have different lengths, then append zeroes to the shorter one
	if (firstVersion.length > secondVersion.length) {
		let diff = firstVersion.length - secondVersion.length;
		secondVersion = secondVersion.concat(new Array(diff).fill(0));
	} else if (secondVersion.length > firstVersion.length) {
		let diff = secondVersion.length - firstVersion.length;
		firstVersion = firstVersion.concat(new Array(diff).fill(0));
	}

	for (let i = 0; i < firstVersion.length; ++i) {
		if (firstVersion[i] > secondVersion[i]) {
			return 1;
		} else if (firstVersion[i] < secondVersion[i]) {
			return -1;
		}
	}
	return 0;
}

export function sortPackageVersions(versions: string[], ascending: boolean = true): string[] {
	return versions.sort((first, second) => {
		let compareResult = comparePackageVersions(first, second);
		if (ascending) {
			return compareResult;
		} else {
			return compareResult * -1;
		}
	});
}

export function isEditorTitleFree(title: string): boolean {

	let hasTextDoc = vscode.workspace.textDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title && !notebookLanguages.find(lang => lang === doc.languageId)) > -1;
	let hasNotebookDoc = azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1;
	return !hasTextDoc && !hasNotebookDoc;
}

export function getClusterEndpoints(serverInfo: azdata.ServerInfo): IEndpoint[] {
	let endpoints: RawEndpoint[] = serverInfo.options['clusterEndpoints'];
	if (!endpoints || endpoints.length === 0) { return []; }

	return endpoints.map(e => {
		// If endpoint is missing, we're on CTP bits. All endpoints from the CTP serverInfo should be treated as HTTPS
		let endpoint = e.endpoint ? e.endpoint : `https://${e.ipAddress}:${e.port}`;
		let updatedEndpoint: IEndpoint = {
			serviceName: e.serviceName,
			description: e.description,
			endpoint: endpoint,
			protocol: e.protocol
		};
		return updatedEndpoint;
	});
}


export type HostAndIp = { host: string, port: string };

export function getHostAndPortFromEndpoint(endpoint: string): HostAndIp {
	let authority = vscode.Uri.parse(endpoint).authority;
	let hostAndPortRegex = /^(.*)([,:](\d+))/g;
	let match = hostAndPortRegex.exec(authority);
	if (match) {
		return {
			host: match[1],
			port: match[3]
		};
	}
	return {
		host: authority,
		port: undefined
	};
}

export async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}

const bdcConfigSectionName = 'bigDataCluster';
const ignoreSslConfigName = 'ignoreSslVerification';

/**
 * Retrieves the current setting for whether to ignore SSL verification errors
 */
export function getIgnoreSslVerificationConfigSetting(): boolean {
	try {
		const config = vscode.workspace.getConfiguration(bdcConfigSectionName);
		return config.get<boolean>(ignoreSslConfigName, true);
	} catch (error) {
		console.error(`Unexpected error retrieving ${bdcConfigSectionName}.${ignoreSslConfigName} setting : ${error}`);
	}
	return true;
}

export function debounce(delay: number): Function {
	return decorate((fn, key) => {
		const timerKey = `$debounce$${key}`;

		return function (this: any, ...args: any[]) {
			clearTimeout(this[timerKey]);
			this[timerKey] = setTimeout(() => fn.apply(this, args), delay);
		};
	});
}

export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	let oct: string = '';
	let tmp: number;
	for (let a: number = 0; a < 4; a++) {
		tmp = (4294967296 * Math.random()) | 0;
		oct += hexValues[tmp & 0xF] +
			hexValues[tmp >> 4 & 0xF] +
			hexValues[tmp >> 8 & 0xF] +
			hexValues[tmp >> 12 & 0xF] +
			hexValues[tmp >> 16 & 0xF] +
			hexValues[tmp >> 20 & 0xF] +
			hexValues[tmp >> 24 & 0xF] +
			hexValues[tmp >> 28 & 0xF];
	}
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
}

// PRIVATE HELPERS /////////////////////////////////////////////////////////
function outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
	data.toString().split(/\r?\n/)
		.forEach(line => {
			outputChannel.appendLine(header + line);
		});
}

function decorate(decorator: (fn: Function, key: string) => Function): Function {
	return (_target: any, key: string, descriptor: any) => {
		let fnKey: string | null = null;
		let fn: Function | null = null;

		if (typeof descriptor.value === 'function') {
			fnKey = 'value';
			fn = descriptor.value;
		} else if (typeof descriptor.get === 'function') {
			fnKey = 'get';
			fn = descriptor.get;
		}

		if (!fn || !fnKey) {
			throw new Error('not supported');
		}

		descriptor[fnKey] = decorator(fn, key);
	};
}

export function getDropdownValue(dropdown: azdata.DropDownComponent): string {
	return (typeof dropdown.value === 'string') ? dropdown.value : dropdown.value.name;
}

/**
 * Creates a random token per https://nodejs.org/api/crypto.html#crypto_crypto_randombytes_size_callback.
 * Defaults to 24 bytes, which creates a 48-char hex string
 */
export async function getRandomToken(size: number = 24): Promise<string> {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(size, (err, buffer) => {
			if (err) {
				reject(err);
			}
			let token = buffer.toString('hex');
			resolve(token);
		});
	});
}
