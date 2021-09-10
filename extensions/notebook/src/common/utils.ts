/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as bdc from 'bdc';
import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as crypto from 'crypto';
import { notebookLanguages, notebookConfigKey, pinnedBooksConfigKey, AUTHTYPE, INTEGRATED_AUTH, KNOX_ENDPOINT_PORT, KNOX_ENDPOINT_SERVER } from './constants';
import { IPrompter, IQuestion, QuestionTypes } from '../prompts/question';
import { BookTreeItemFormat, BookTreeItemType } from '../book/bookTreeItem';
import * as loc from './localizedConstants';

const localize = nls.loadMessageBundle();

export function getKnoxUrl(host: string, port: string): string {
	return `https://${host}:${port}/gateway`;
}

export function getLivyUrl(serverName: string, port: string): string {
	return this.getKnoxUrl(serverName, port) + '/default/livy/v1/';
}

export async function ensureDir(dirPath: string, outputChannel?: vscode.OutputChannel): Promise<void> {
	outputChannel?.appendLine(localize('ensureDirOutputMsg', "... Ensuring {0} exists", dirPath));
	await fs.ensureDir(dirPath);
}
export function ensureDirSync(dirPath: string, outputChannel?: vscode.OutputChannel): void {
	outputChannel?.appendLine(localize('ensureDirOutputMsg', "... Ensuring {0} exists", dirPath));
	fs.ensureDirSync(dirPath);
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
export function compareVersions(first: string, second: string): number {
	let firstVersion = first.split('.');
	let secondVersion = second.split('.');

	// If versions have different lengths, then append zeroes to the shorter one
	if (firstVersion.length > secondVersion.length) {
		let diff = firstVersion.length - secondVersion.length;
		secondVersion = secondVersion.concat(new Array(diff).fill('0'));
	} else if (secondVersion.length > firstVersion.length) {
		let diff = secondVersion.length - firstVersion.length;
		firstVersion = firstVersion.concat(new Array(diff).fill('0'));
	}

	for (let i = 0; i < firstVersion.length; ++i) {
		// Using asterisks means any version number is equivalent, so skip this value
		if (firstVersion[i] === '*' || secondVersion[i] === '*') {
			continue;
		}

		let firstVersionNum: string | number = Number(firstVersion[i]);
		let secondVersionNum: string | number = Number(secondVersion[i]);

		// Fallback to string comparison if either value isn't a number
		if (isNaN(firstVersionNum) || isNaN(secondVersionNum)) {
			firstVersionNum = firstVersion[i];
			secondVersionNum = secondVersion[i];
		}

		if (firstVersionNum > secondVersionNum) {
			return 1;
		} else if (firstVersionNum < secondVersionNum) {
			return -1;
		}
	}
	return 0;
}

export function sortPackageVersions(versions: string[], ascending: boolean = true): string[] {
	return versions.sort((first, second) => {
		let compareResult = compareVersions(first, second);
		if (ascending) {
			return compareResult;
		} else {
			return compareResult * -1;
		}
	});
}

const specifierFirstCharMatch = /[><=!]/;

// Determines if a given package is supported for the provided version of Python
// using the version constraints from the pypi metadata.
export function isPackageSupported(pythonVersion: string, packageVersionConstraints: string[]): boolean {
	if (pythonVersion === '') {
		return true;
	}

	// Version constraint strings are formatted like '!=2.7, >=3.5, >=3.6',
	// with each package release having its own set of version constraints.
	let supportedVersionFound = true;
	for (let packageVersionConstraint of packageVersionConstraints) {
		if (!packageVersionConstraint) {
			continue;
		}

		let constraintParts = packageVersionConstraint.split(',');
		for (let constraint of constraintParts) {
			constraint = constraint.trim();
			if (constraint.length === 0) {
				continue;
			}

			let splitIndex: number;
			if (!constraint[0].match(specifierFirstCharMatch)) {
				splitIndex = -1; // No version specifier is included with this version number
			} else if ((constraint[0] === '>' || constraint[0] === '<') && constraint[1] !== '=') {
				splitIndex = 1;
			} else {
				splitIndex = 2;
			}

			let versionSpecifier: string;
			let version: string;
			if (splitIndex === -1) {
				versionSpecifier = '=='; // If there's no version specifier, then we need to match the version exactly
				version = constraint;
			} else {
				versionSpecifier = constraint.slice(0, splitIndex);
				version = constraint.slice(splitIndex).trim();
			}
			let versionComparison = compareVersions(pythonVersion, version);
			switch (versionSpecifier) {
				case '>=':
					supportedVersionFound = versionComparison !== -1;
					break;
				case '<=':
					supportedVersionFound = versionComparison !== 1;
					break;
				case '>':
					supportedVersionFound = versionComparison === 1;
					break;
				case '<':
					supportedVersionFound = versionComparison === -1;
					break;
				case '==':
					supportedVersionFound = versionComparison === 0;
					break;
				case '!=':
					supportedVersionFound = versionComparison !== 0;
					break;
				default:
					// We hit an unexpected version specifier. Rather than throw an error here, we should
					// let the package be installable so that we're not too restrictive by mistake.
					// Trying to install the package will still throw its own unsupported version error later.
					supportedVersionFound = true; // The package is tentatively supported until we find a constraint that fails
					break;
			}
			if (!supportedVersionFound) {
				break; // Failed at least one version check, so skip checking the other constraints
			}
		}
		if (supportedVersionFound) {
			break; // All constraints passed for this package, so we don't need to check any of the others
		}
	}
	return supportedVersionFound;
}

export function isEditorTitleFree(title: string): boolean {

	let hasTextDoc = vscode.workspace.textDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title && !notebookLanguages.find(lang => lang === doc.languageId)) > -1;
	let hasNotebookDoc = azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1;
	return !hasTextDoc && !hasNotebookDoc;
}

export function getClusterEndpoints(serverInfo: azdata.ServerInfo): bdc.IEndpointModel[] {
	let endpoints: RawEndpoint[] = serverInfo.options['clusterEndpoints'];
	if (!endpoints || endpoints.length === 0) { return []; }

	return endpoints.map(e => {
		// If endpoint is missing, we're on CTP bits. All endpoints from the CTP serverInfo should be treated as HTTPS
		let endpoint = e.endpoint ? e.endpoint : `https://${e.ipAddress}:${e.port}`;
		let updatedEndpoint: bdc.IEndpointModel = {
			name: e.serviceName,
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

export function isIntegratedAuth(connection: azdata.IConnectionProfile): boolean {
	return connection.options[AUTHTYPE] && connection.options[AUTHTYPE].toLowerCase() === INTEGRATED_AUTH.toLowerCase();
}

export function isSparkKernel(kernelName: string): boolean {
	return kernelName && kernelName.toLowerCase().indexOf('spark') > -1;
}

export function setHostAndPort(delimeter: string, connection: azdata.IConnectionProfile): void {
	let originalHost = connection.options[KNOX_ENDPOINT_SERVER];
	if (!originalHost) {
		return;
	}
	let index = originalHost.indexOf(delimeter);
	if (index > -1) {
		connection.options[KNOX_ENDPOINT_SERVER] = originalHost.slice(0, index);
		connection.options[KNOX_ENDPOINT_PORT] = originalHost.slice(index + 1);
	}
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
		console.error('Unexpected error retrieving ${bdcConfigSectionName}.${ignoreSslConfigName} setting : ', error);
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

export function isBookItemPinned(notebookPath: string): boolean {
	let pinnedNotebooks: IPinnedNotebook[] = getPinnedNotebooks();
	if (pinnedNotebooks?.find(x => x.notebookPath === notebookPath)) {
		return true;
	}
	return false;
}

export function getNotebookType(book: BookTreeItemFormat): BookTreeItemType {
	if (book.tableOfContents.sections) {
		return BookTreeItemType.savedBookNotebook;
	}
	else {
		return BookTreeItemType.savedNotebook;
	}
}

export function getPinnedNotebooks(): IPinnedNotebook[] {
	let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(notebookConfigKey);
	let pinnedNotebooks: [] = config.get(pinnedBooksConfigKey);
	let updateFormat: boolean = false;
	const pinnedBookDirectories = pinnedNotebooks.map(elem => {
		if (typeof (elem) === 'string') {
			updateFormat = true;
			return { notebookPath: elem, bookPath: '', title: '' };
		} else {
			return elem as IPinnedNotebook;
		}
	});
	if (updateFormat) {
		//Need to modify the format of how pinnedNotebooks are stored for users that used the September release version.
		setPinnedBookPathsInConfig(pinnedBookDirectories).catch(err => console.error('Error setting pinned notebook paths in config ', err));
	}
	return pinnedBookDirectories;
}

function hasWorkspaceFolders(): boolean {
	let workspaceFolders = vscode.workspace.workspaceFolders;
	return workspaceFolders && workspaceFolders.length > 0;
}

export async function setPinnedBookPathsInConfig(pinnedNotebookPaths: IPinnedNotebook[]): Promise<void> {
	let config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(notebookConfigKey);
	let storeInWorspace: boolean = hasWorkspaceFolders();

	await config.update(pinnedBooksConfigKey, pinnedNotebookPaths, storeInWorspace ? false : vscode.ConfigurationTarget.Global);
}


export interface IPinnedNotebook {
	bookPath?: string;
	title?: string;
	notebookPath: string;
}

export enum FileExtension {
	Markdown = '.md',
	Notebook = '.ipynb'
}


//Confirmation message dialog
export async function confirmMessageDialog(prompter: IPrompter, msg: string): Promise<boolean> {
	return await prompter.promptSingle<boolean>(<IQuestion>{
		type: QuestionTypes.confirm,
		message: msg,
		default: false
	});
}

export async function selectFolder(): Promise<string | undefined> {
	let uris = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectMany: false,
		canSelectFolders: true,
		openLabel: loc.labelSelectFolder
	});
	if (uris?.length > 0) {
		return uris[0].fsPath;
	}
	return undefined;
}
