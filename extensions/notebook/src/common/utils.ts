/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as childProcess from 'child_process';
import * as fs from 'fs-extra';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as azdata from 'azdata';

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

// PRIVATE HELPERS /////////////////////////////////////////////////////////
function outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
	data.toString().split(/\r?\n/)
		.forEach(line => {
			outputChannel.appendLine(header + line);
		});
}

export function isEditorTitleFree(title: string): boolean {
	let hasTextDoc = vscode.workspace.textDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1;
	let hasNotebookDoc = azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1;
	return !hasTextDoc && !hasNotebookDoc;
}

export function getClusterEndpoints(serverInfo: azdata.ServerInfo): IEndpoint[] | undefined {
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
