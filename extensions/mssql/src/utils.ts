/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as findRemoveSync from 'find-remove';
import { promises as fs } from 'fs';
import { IConfig, ServerProvider } from '@microsoft/ads-service-downloader';
import { env } from 'process';

const configTracingLevel = 'tracingLevel';
const configPiiLogging = 'piiLogging';
const configLogRetentionMinutes = 'logRetentionMinutes';
const configLogFilesRemovalLimit = 'logFilesRemovalLimit';
const extensionConfigSectionName = 'mssql';
const configLogDebugInfo = 'logDebugInfo';
const parallelMessageProcessingConfig = 'parallelMessageProcessing';
const parallelMessageProcessingLimitConfig = 'parallelMessageProcessingLimit';
const enableSqlAuthenticationProviderConfig = 'enableSqlAuthenticationProvider';
const enableConnectionPoolingConfig = 'enableConnectionPooling';
const tableDesignerPreloadConfig = 'tableDesigner.preloadDatabaseModel';
const httpConfig = 'http';
const configProxy = 'proxy';
const configProxyStrictSSL = 'proxyStrictSSL';

/**
 *
 * @returns Whether the current OS is linux or not
 */
export const isLinux = os.platform() === 'linux';

// The function is a duplicate of \src\paths.js. IT would be better to import path.js but it doesn't
// work for now because the extension is running in different process.
export function getAppDataPath() {
	let platform = process.platform;
	switch (platform) {
		case 'win32': return process.env['APPDATA'] || path.join(process.env['USERPROFILE'] || '', 'AppData', 'Roaming');
		case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support');
		case 'linux': return process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config');
		default: throw new Error('Platform not supported');
	}
}

/**
 * Get a file name that is not already used in the target directory
 * @param filePath source notebook file name
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
	return vscode.workspace.getConfiguration(config);
}

export function getConfigLogFilesRemovalLimit(): number | undefined {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogFilesRemovalLimit]).toFixed(0));
	} else {
		return undefined;
	}
}

export function getConfigLogRetentionSeconds(): number | undefined {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogRetentionMinutes] * 60).toFixed(0));
	} else {
		return undefined;
	}
}

export function getHttpProxyUrl(): string | undefined {
	let config = getConfiguration(httpConfig);
	if (config) {
		return config[configProxy];
	} return undefined;
}

export function getHttpProxyStrictSSL(): boolean {
	let config = getConfiguration(httpConfig);
	if (config) {
		return config.get<boolean>(configProxyStrictSSL, true); // true by default
	} return true; // true by default.
}
/**
 * The tracing level defined in the package.json
 */
export enum TracingLevel {
	All = 'All',
	Off = 'Off',
	Critical = 'Critical',
	Error = 'Error',
	Warning = 'Warning',
	Information = 'Information',
	Verbose = 'Verbose'
}

export function getConfigTracingLevel(): TracingLevel {
	let config = getConfiguration();
	if (config) {
		return config[configTracingLevel];
	} else {
		return TracingLevel.Critical;
	}
}

export function getConfigPiiLogging(): boolean {
	let config = getConfiguration();
	if (config) {
		return config[configPiiLogging];
	} else {
		return false;
	}
}

export function getConfigPreloadDatabaseModel(): boolean {
	let config = getConfiguration();
	if (config) {
		return config.get<boolean>(tableDesignerPreloadConfig, false);
	} else {
		return false;
	}
}

export function setConfigPreloadDatabaseModel(enable: boolean): void {
	let config = getConfiguration();
	if (config) {
		void config.update(tableDesignerPreloadConfig, enable, true);
	}
}

/**
 * Retrieves configuration `mssql:parallelMessageProcessing` from settings file.
 * @returns true if setting is enabled in ADS (enabled by default).
 */
export function getParallelMessageProcessingConfig(): boolean {
	const config = getConfiguration();
	if (!config) {
		return true; // default value
	}
	return config[parallelMessageProcessingConfig];
}

/**
 * Retrieves configuration `mssql:parallelMessageProcessingLimit` from settings file.
 * @returns max number of parallel messages that are allowed to be processed by backend service, 100 by default.
 */
export function getParallelMessageProcessingLimitConfig(): number {
	const config = getConfiguration();
	if (!config) {
		return 100; // default value
	}
	return config[parallelMessageProcessingLimitConfig];
}
/**
 * Retrieves configuration `mssql:enableSqlAuthenticationProvider` from settings file.
 * @returns true if setting is enabled in ADS, false otherwise.
 */
export function getEnableSqlAuthenticationProviderConfig(): boolean {
	const config = getConfiguration();
	if (config) {
		return config.get<boolean>(enableSqlAuthenticationProviderConfig, true); // enabled by default
	}
	else {
		return true;
	}
}

/**
 * Retrieves configuration `mssql:enableConnectionPooling` from settings file.
 * @returns true if setting is enabled in ADS or running ADS in dev mode.
 */
export function getEnableConnectionPoolingConfig(): boolean {
	const config = getConfiguration();
	if (config) {
		const setting = config.inspect(enableConnectionPoolingConfig);
		return (azdata.env.quality === azdata.env.AppQuality.dev && setting?.globalValue === undefined && setting?.workspaceValue === undefined) ? true : config[enableConnectionPoolingConfig];
	}
	else {
		return true; // enabled by default
	}
}

export function getLogFileName(prefix: string, pid: number): string {
	return `${prefix}_${pid}.log`;
}

export function getCommonLaunchArgsAndCleanupOldLogFiles(logPath: string, fileName: string, executablePath: string): string[] {
	let launchArgs = [];
	// Application Name determines app storage location or user data path.
	launchArgs.push('--application-name', 'azuredatastudio');
	launchArgs.push('--data-path', getAppDataPath());

	launchArgs.push(`--locale`, vscode.env.language);

	launchArgs.push('--log-file');
	let logFile = path.join(logPath, fileName);
	launchArgs.push(logFile);

	console.log(`logFile for ${path.basename(executablePath)} is ${logFile}`);
	console.log(`This process (ui Extension Host) is pid: ${process.pid}`);
	// Delete old log files
	let deletedLogFiles = removeOldLogFiles(logPath, fileName);
	console.log(`Old log files deletion report: ${JSON.stringify(deletedLogFiles)}`);
	launchArgs.push('--tracing-level');
	launchArgs.push(getConfigTracingLevel());
	if (getConfigPiiLogging()) {
		launchArgs.push('--pii-logging');
	}
	// Always enable autoflush so that log entries are written immediately to disk, otherwise we can end up with partial logs
	launchArgs.push('--autoflush-log');

	let httpProxy = getHttpProxyUrl();
	if (httpProxy) {
		launchArgs.push('--http-proxy-url');
		launchArgs.push(httpProxy);
		if (getHttpProxyStrictSSL()) {
			launchArgs.push('--http-proxy-strict-ssl')
		}
	}
	return launchArgs;
}

export function ensure(target: { [key: string]: any }, key: string): any {
	if (target[key] === void 0) {
		target[key] = {};
	}
	return target[key];
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
		errorMessage = error.responseText as string;
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
	return process.env.HOME || process.env.USERPROFILE || '';
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
export function logDebug(msg: unknown): void {
	let config = vscode.workspace.getConfiguration(extensionConfigSectionName);
	let logDebugInfo = !!config[configLogDebugInfo];
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

const STS_OVERRIDE_ENV_VAR = 'ADS_SQLTOOLSSERVICE';
let overrideMessageDisplayed = false;
/**
 * Gets the full path to the EXE for the specified tools service, downloading it in the process if necessary. The location
 * for this can be overridden with an environment variable for debugging or other purposes.
 * @param config The configuration values of the server to get/download
 * @param handleServerEvent A callback for handling events from the server downloader
 * @returns The path to the server exe
 */
export async function getOrDownloadServer(config: IConfig, handleServerEvent?: (e: string, ...args: any[]) => void): Promise<string> {
	// This env var is used to override the base install location of STS - primarily to be used for debugging scenarios.
	try {
		const stsRootPath = env[STS_OVERRIDE_ENV_VAR];
		if (stsRootPath) {
			for (const exeFile of config.executableFiles) {
				const serverFullPath = path.join(stsRootPath, exeFile);
				if (await exists(serverFullPath)) {
					const overrideMessage = `Using ${exeFile} from ${stsRootPath}`;
					// Display message to the user so they know the override is active, but only once so we don't show too many
					if (!overrideMessageDisplayed) {
						overrideMessageDisplayed = true;
						void vscode.window.showInformationMessage(overrideMessage);
					}
					console.log(overrideMessage);
					return serverFullPath;
				}
			}
			console.warn(`Could not find valid SQL Tools Service EXE from ${JSON.stringify(config.executableFiles)} at ${stsRootPath}, falling back to config`);
		}
	} catch (err) {
		console.warn('Unexpected error getting override path for SQL Tools Service client ', err);
		// Fall back to config if something unexpected happens here
	}

	const serverdownloader = new ServerProvider(config);
	if (handleServerEvent) {
		serverdownloader.eventEmitter.onAny(handleServerEvent);
	}

	return serverdownloader.getOrDownloadServer();
}

