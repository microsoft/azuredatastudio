/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import * as findRemoveSync from 'find-remove';
import * as constants from './constants';

const configTracingLevel = 'tracingLevel';
const configLogRetentionMinutes = 'logRetentionMinutes';
const configLogFilesRemovalLimit = 'logFilesRemovalLimit';
const extensionConfigSectionName = 'mssql';
const configLogDebugInfo = 'logDebugInfo';

// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
export function getAppDataPath() {
	let platform = process.platform;
	switch (platform) {
		case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'], 'AppData', 'Roaming');
		case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

export function removeOldLogFiles(prefix: string): JSON {
	return findRemoveSync(getDefaultLogDir(), { prefix: `${prefix}_`, age: { seconds: getConfigLogRetentionSeconds() }, limit: getConfigLogFilesRemovalLimit() });
}

export function getConfiguration(config: string = extensionConfigSectionName): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(extensionConfigSectionName);
}

export function getConfigLogFilesRemovalLimit(): number {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogFilesRemovalLimit]).toFixed(0));
	}
	else {
		return undefined;
	}
}

export function getConfigLogRetentionSeconds(): number {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogRetentionMinutes] * 60).toFixed(0));
	}
	else {
		return undefined;
	}
}

export function getConfigTracingLevel(): string {
	let config = getConfiguration();
	if (config) {
		return config[configTracingLevel];
	}
	else {
		return undefined;
	}
}

export function getDefaultLogDir(): string {
	return path.join(process.env['VSCODE_LOGS'], '..', '..', 'mssql');
}

export function getDefaultLogFile(prefix: string, pid: number): string {
	return path.join(getDefaultLogDir(), `${prefix}_${pid}.log`);
}

export function getCommonLaunchArgsAndCleanupOldLogFiles(prefix: string, executablePath: string): string[] {
	let launchArgs = [];
	launchArgs.push('--log-file');
	let logFile = getDefaultLogFile(prefix, process.pid);
	launchArgs.push(logFile);

	console.log(`logFile for ${path.basename(executablePath)} is ${logFile}`);
	console.log(`This process (ui Extenstion Host) is pid: ${process.pid}`);
	// Delete old log files
	let deletedLogFiles = removeOldLogFiles(prefix);
	console.log(`Old log files deletion report: ${JSON.stringify(deletedLogFiles)}`);
	launchArgs.push('--tracing-level');
	launchArgs.push(getConfigTracingLevel());
	return launchArgs;
}

export function ensure(target: object, key: string): any {
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

export function getPackageInfo(packageJson: any): IPackageInfo {
	if (packageJson) {
		return {
			name: packageJson.name,
			version: packageJson.version,
			aiKey: packageJson.aiKey
		};
	}
}

export function generateUserId(): Promise<string> {
	return new Promise<string>(resolve => {
		try {
			let interfaces = os.networkInterfaces();
			let mac;
			for (let key of Object.keys(interfaces)) {
				let item = interfaces[key][0];
				if (!item.internal) {
					mac = item.mac;
					break;
				}
			}
			if (mac) {
				resolve(crypto.createHash('sha256').update(mac + os.homedir(), 'utf8').digest('hex'));
			} else {
				resolve(generateGuid());
			}
		} catch (err) {
			resolve(generateGuid()); // fallback
		}
	});
}

export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
	let oct: string = '';
	let tmp: number;
	/* tslint:disable:no-bitwise */
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

	// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
	/* tslint:enable:no-bitwise */
}

export function verifyPlatform(): Thenable<boolean> {
	if (os.platform() === 'darwin' && parseFloat(os.release()) < 16.0) {
		return Promise.resolve(false);
	} else {
		return Promise.resolve(true);
	}
}

export function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

export function isObjectExplorerContext(object: any): object is sqlops.ObjectExplorerContext {
	return 'connectionProfile' in object && 'isConnectionNode' in object;
}

export function getUserHome(): string {
	return process.env.HOME || process.env.USERPROFILE;
}

export async function getClusterEndpoint(profileId: string, serviceName: string): Promise<IEndpoint> {

	let serverInfo: sqlops.ServerInfo = await sqlops.connection.getServerInfo(profileId);
	if (!serverInfo || !serverInfo.options) {
		return undefined;
	}
	let endpoints: IEndpoint[] = serverInfo.options[constants.clusterEndpointsProperty];
	if (!endpoints || endpoints.length === 0) {
		return undefined;
	}
	let index = endpoints.findIndex(ep => ep.serviceName === serviceName);
	if (index === -1) {
		return undefined;
	}
	let clusterEndpoint: IEndpoint = {
		serviceName: endpoints[index].serviceName,
		ipAddress: endpoints[index].ipAddress,
		port: endpoints[index].port
	};
	return clusterEndpoint;
}

interface IEndpoint {
	serviceName: string;
	ipAddress: string;
	port: number;
}

export function isValidNumber(maybeNumber: any) {
	return maybeNumber !== undefined
		&& maybeNumber !== null
		&& maybeNumber !== ''
		&& !isNaN(Number(maybeNumber.toString()));
}

/**
 * Helper to log messages to the developer console if enabled
 * @param msg Message to log to the console
 */
export function logDebug(msg: any): void {
	let config = vscode.workspace.getConfiguration(extensionConfigSectionName);
	let logDebugInfo = config[configLogDebugInfo];
	if (logDebugInfo === true) {
		let currentTime = new Date().toLocaleTimeString();
		let outputMsg = '[' + currentTime + ']: ' + msg ? msg.toString() : '';
		console.log(outputMsg);
	}
}
