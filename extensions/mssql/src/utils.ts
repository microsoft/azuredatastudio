/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as bdc from 'bdc';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import * as findRemoveSync from 'find-remove';
import * as constants from './constants';
import { promises as fs } from 'fs';

const configTracingLevel = 'tracingLevel';
const configLogRetentionMinutes = 'logRetentionMinutes';
const configLogFilesRemovalLimit = 'logFilesRemovalLimit';
const extensionConfigSectionName = 'mssql';
const configLogDebugInfo = 'logDebugInfo';
const configUseKeytarCredential = 'useKeytarCredential';
const configMigrateLinuxCredential = 'migrateLinuxCredential';

// Credential Constants
const CRED_PREFIX = 'Microsoft.SqlTools';
const CRED_SEPARATOR = '|';
const CRED_ID_PREFIX = 'id:';
const CRED_ITEMTYPE_PREFIX = 'itemtype:';
const CRED_NAME_VALUE_SEPARATOR = ':';
const CRED_PROVIDER_NAME = 'providerName';
export const CRED_PROFILE_USER = 'Profile';

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

/**
 *
 * @returns Whether the current OS is linux or not
 */
export function isLinux(): boolean {
	return os.platform() === 'linux';
}

/**
 * This function returns whether the native credential management system
 * should be used instead of tools service
 */
export function keytarCredentialsEnabled(): boolean {
	const linux: boolean = isLinux();
	const useKeytarCredential: boolean = getConfigKeytar();
	return linux && useKeytarCredential;
}

/**
 * Gets the prefix for a formatted credential ID
 */

function getConnectionInfoId() {
	let idNames = ['authenticationType', 'database', 'server', 'user'];

	//Sort to make sure using names in the same order every time otherwise the ids would be different
	idNames.sort();

	let idValues: string[] = [];
	for (let index = 0; index < idNames.length; index++) {
		let value = this.options[idNames[index]!];
		value = value ? value : '';
		idValues.push(`${idNames[index]}${CRED_NAME_VALUE_SEPARATOR}${value}`);
	}
	return CRED_PROVIDER_NAME + CRED_SEPARATOR + this.providerName + CRED_SEPARATOR + idValues.join(CRED_SEPARATOR);
}

/**
 * Creates a formatted credential usable for uniquely identifying a SQL Connection.
 * This string can be decoded but is not optimized for this.
 * @param connectionProfile connection profile - require
 * @param itemType type of the item (MRU or Profile) - optional
 * @returns formatted string with server, DB and username
 */
export function formatCredentialId(connectionProfile: azdata.connection.ConnectionProfile): string {
	const cred: string[] = [CRED_PREFIX];
	cred.push(CRED_ITEMTYPE_PREFIX.concat(CRED_PROFILE_USER));
	cred.push(CRED_ID_PREFIX.concat(getConnectionInfoId()));
	return cred.join(CRED_SEPARATOR);
}

/**
 * This function returns whether the user wants to delete the old credentials
 * from their Linux system when migrating to keytar
 * It's true by default, and the system tries to migrate if true, else skips
 * since it can only be false if the user set it or the migration is done
 * @returns
 */
export function migrateLinuxCredentials(): boolean {
	const linux: boolean = isLinux();
	const migrateLinuxCredentials: boolean = getConfigMigrateLinuxCredential();
	return linux && migrateLinuxCredentials;
}

/**
 * Switches off the setting/flag migrateLinuxCredentials which controls
 * the migration of credentials. This is set to false either when the user
 * explicitly refuses to migrate or when the migration is all done
 */
export function disableCredentialMigration() {
	let config = getConfiguration();
	config.update(configMigrateLinuxCredential, false);
}

/**
 * Get a file name that is not already used in the target directory
 * @param filePath source notebook file name
 * @param fileExtension file type
 */
export function findNextUntitledEditorName(filePath: string): string {
	const fileExtension = path.extname(filePath);
	const baseName = path.basename(filePath, fileExtension);
	let idx = 0;
	let title = `${baseName}`;
	do {
		const suffix = idx === 0 ? '' : `-${idx}`;
		title = `${baseName}${suffix}`;
		idx++;
	} while (azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1);

	return title;
}

export function removeOldLogFiles(logPath: string, prefix: string): JSON {
	return findRemoveSync(logPath, { age: { seconds: getConfigLogRetentionSeconds() }, limit: getConfigLogFilesRemovalLimit() });
}

export function getConfiguration(config: string = extensionConfigSectionName): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(extensionConfigSectionName);
}

export function getConfigLogFilesRemovalLimit(): number {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogFilesRemovalLimit]).toFixed(0));
	} else {
		return undefined;
	}
}

export function getConfigLogRetentionSeconds(): number {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogRetentionMinutes] * 60).toFixed(0));
	} else {
		return undefined;
	}
}

export function getConfigTracingLevel(): string {
	let config = getConfiguration();
	if (config) {
		return config[configTracingLevel];
	} else {
		return undefined;
	}
}

/**
 *
 * @returns The setting that tells ADS to use keytar for credentials or not
 */
function getConfigKeytar(): boolean {
	let config = getConfiguration();
	if (config) {
		return Boolean(config[configUseKeytarCredential]);
	} else {
		return undefined;
	}
}

/**
 *
 * @returns The setting that tells whether the user wants the old credentials
 * deleted from their linux system
 */
function getConfigMigrateLinuxCredential(): boolean {
	let config = getConfiguration();
	if (config) {
		return Boolean(config[configMigrateLinuxCredential]);
	} else {
		return undefined;
	}
}

export function getLogFileName(prefix: string, pid: number): string {
	return `${prefix}_${pid}.log`;
}

export function getCommonLaunchArgsAndCleanupOldLogFiles(logPath: string, fileName: string, executablePath: string): string[] {
	let launchArgs = [];
	launchArgs.push('--log-file');
	let logFile = path.join(logPath, fileName);
	launchArgs.push(logFile);

	console.log(`logFile for ${path.basename(executablePath)} is ${logFile}`);
	console.log(`This process (ui Extenstion Host) is pid: ${process.pid}`);
	// Delete old log files
	let deletedLogFiles = removeOldLogFiles(logPath, fileName);
	console.log(`Old log files deletion report: ${JSON.stringify(deletedLogFiles)}`);
	launchArgs.push('--tracing-level');
	launchArgs.push(getConfigTracingLevel());
	return launchArgs;
}

export function ensure(target: { [key: string]: any }, key: string): any {
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
	return undefined;
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
	if (os.platform() === 'darwin' && parseFloat(os.release()) < 16) {
		return Promise.resolve(false);
	} else {
		return Promise.resolve(true);
	}
}

export function getErrorMessage(error: Error | any, removeHeader: boolean = false): string {
	let errorMessage: string;
	if (error instanceof Error) {
		errorMessage = error.message;
	} else if (error.responseText) {
		errorMessage = error.responseText;
		if (error.status) {
			errorMessage += ` (${error.status})`;
		}
	} else {
		errorMessage = JSON.stringify(error.toString());
	}
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

export function getUserHome(): string {
	return process.env.HOME || process.env.USERPROFILE;
}

export function getClusterEndpoints(serverInfo: azdata.ServerInfo): bdc.IEndpointModel[] | undefined {
	let endpoints: RawEndpoint[] = serverInfo.options[constants.clusterEndpointsProperty];
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

export async function isBigDataCluster(connectionId: string): Promise<boolean> {
	const serverInfo = await azdata.connection.getServerInfo(connectionId);

	return !!serverInfo?.options?.[constants.isBigDataClusterProperty];
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

interface RawEndpoint {
	serviceName: string;
	description?: string;
	endpoint?: string;
	protocol?: string;
	ipAddress?: string;
	port?: number;
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

export async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}
