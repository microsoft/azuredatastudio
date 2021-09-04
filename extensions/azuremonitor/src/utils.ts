/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//TODO: This is the same file from mssql. Move this into a common place.
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as findRemoveSync from 'find-remove';
import { promises as fs } from 'fs';

const configTracingLevel = 'tracingLevel';
const configLogRetentionMinutes = 'logRetentionMinutes';
const configLogFilesRemovalLimit = 'logFilesRemovalLimit';
const extensionConfigSectionName = 'azuremonitor';

export function removeOldLogFiles(logPath: string, _prefix: string): JSON {
	return findRemoveSync(logPath, { age: { seconds: getConfigLogRetentionSeconds() }, limit: getConfigLogFilesRemovalLimit() });
}

export function getConfiguration(_config: string = extensionConfigSectionName): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(extensionConfigSectionName);
}

export function getConfigLogFilesRemovalLimit(): number | undefined {
	let config = getConfiguration();
	if (config && config[configLogFilesRemovalLimit]) {
		return Number((config[configLogFilesRemovalLimit]).toFixed(0));
	}
	else {
		return undefined;
	}
}

export function getConfigLogRetentionSeconds(): number | undefined {
	let config = getConfiguration();
	if (config && config[configLogRetentionMinutes]) {
		return Number((config[configLogRetentionMinutes] * 60).toFixed(0));
	}
	else {
		return undefined;
	}
}

export function getConfigTracingLevel(): string | undefined {
	let config = getConfiguration();
	if (config) {
		return config[configTracingLevel];
	}
	else {
		return undefined;
	}
}

export function getLogFileName(prefix: string, pid: number): string {
	return `${prefix}_${pid}.log`;
}

export function getCommonLaunchArgsAndCleanupOldLogFiles(logPath: string, fileName: string, executablePath: string): string[] {
	let launchArgs: string[] = [];
	launchArgs.push(`--locale`, vscode.env.language);

	launchArgs.push('--log-file');
	let logFile = path.join(logPath, fileName);
	launchArgs.push(logFile);

	console.log(`logFile for ${path.basename(executablePath)} is ${logFile}`);
	console.log(`This process (ui Extenstion Host) is pid: ${process.pid}`);
	// Delete old log files
	let deletedLogFiles = removeOldLogFiles(logPath, fileName);
	console.log(`Old log files deletion report: ${JSON.stringify(deletedLogFiles)}`);
	let config = getConfigTracingLevel();
	if (config) {
		launchArgs.push('--tracing-level');
		launchArgs.push(config);
	}

	launchArgs.push('--service-name');
	launchArgs.push('AzureMonitor');

	return launchArgs;
}

export function ensure(target: any, key: string): any {
	if (target[key] === void 0) {
		target[key] = {} as any;
	}
	return target[key];
}

export interface IPackageInfo {
	name: string;
	version: string;
	aiKey: string;
}

export function getPackageInfo(packageJson: IPackageInfo): IPackageInfo | undefined {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
	return undefined;
}

export function verifyPlatform(): Thenable<boolean> {
	if (os.platform() === 'darwin' && parseFloat(os.release()) < 16) {
		return Promise.resolve(false);
	} else {
		return Promise.resolve(true);
	}
}

export function getErrorMessage(error: Error | any, removeHeader: boolean = false): string {
	let errorMessage: string = (error instanceof Error) ? error.message : error.toString();
	if (removeHeader) {
		errorMessage = removeErrorHeader(errorMessage);
	}
	return errorMessage;
}

export function removeErrorHeader(errorMessage: string): string {
	if (errorMessage && errorMessage !== '') {
		let header: string = 'Error:';
		if (errorMessage.startsWith(header)) {
			errorMessage = errorMessage.substring(header.length);
		}
	}
	return errorMessage;
}

export function isObjectExplorerContext(object: any): object is azdata.ObjectExplorerContext {
	return 'connectionProfile' in object && 'isConnectionNode' in object;
}

export async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}
