/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import * as findRemoveSync from 'find-remove';
import { promises as fs } from 'fs';
import { IConfig, ServerProvider } from '@microsoft/ads-service-downloader';
import { env } from 'process';

const configTracingLevel = 'tracingLevel';
const configLogRetentionMinutes = 'logRetentionMinutes';
const configLogFilesRemovalLimit = 'logFilesRemovalLimit';
const extensionConfigSectionName = 'mssql';
const parallelMessageProcessingConfig = 'parallelMessageProcessing';
const STS_OVERRIDE_ENV_VAR = 'ADS_SQLTOOLSSERVICE';
let overrideMessageDisplayed = false;

export const AvailableServices = {
	DemoService: 'demoService',
};

export const ServerServiceName = 'Azure SQL Migration Services';
export const ProviderId = 'SQL Migration';
export const ServiceCrashLink = 'https://github.com/microsoft/azuredatastudio/tree/main/extensions/sql-migration/wiki/Known-Issues';
export const ExtensionConfigSectionName = 'sqlmigration';

/**
 * Gets the full path to the EXE for the specified tools service, downloading it in the process if necessary. The location
 * for this can be overridden with an environment variable for debugging or other purposes.
 * @param config The configuration values of the server to get/download
 * @param handleServerEvent A callback for handling events from the server downloader
 * @returns The path to the server exe
 */
export async function getOrDownloadServer(config: IConfig, handleServerEvent?: (event: string | string[], ...args: any[]) => void): Promise<string> {
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

async function exists(path: string): Promise<boolean> {
	try {
		await fs.access(path);
		return true;
	} catch (e) {
		return false;
	}
}

export function getCommonLaunchArgsAndCleanupOldLogFiles(logPath: string, fileName: string, executablePath: string) {
	let launchArgs = [];
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
	// Always enable autoflush so that log entries are written immediately to disk, otherwise we can end up with partial logs
	launchArgs.push('--autoflush-log');
	return launchArgs;
}

export async function getParallelMessageProcessingConfig(): Promise<boolean> {
	const config = getConfiguration();
	if (!config) {
		return false;
	}
	const quality = await getProductQuality();
	const setting = config.inspect(parallelMessageProcessingConfig);
	// For dev environment, we want to enable the feature by default unless it is set explicitely.
	// Note: the quality property is not set for dev environment, we can use this to determine whether it is dev environment.
	return (quality === undefined && setting !== undefined && setting.globalValue === undefined && setting.workspaceValue === undefined) ? true : config[parallelMessageProcessingConfig];
}

async function getProductQuality(): Promise<string> {
	const content = await fs.readFile(path.join(vscode.env.appRoot, 'product.json'));
	return JSON.parse(content?.toString())?.quality;
}


function getConfigTracingLevel(): string {
	let config = getConfiguration();
	if (config) {
		return config[configTracingLevel];
	} else {
		return '';
	}
}

function getConfiguration(config: string = extensionConfigSectionName): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration(extensionConfigSectionName);
}


function removeOldLogFiles(logPath: string, prefix: string): any {
	return findRemoveSync(logPath, { age: { seconds: getConfigLogRetentionSeconds() }, limit: getConfigLogFilesRemovalLimit() });
}

function getConfigLogRetentionSeconds(): number {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogRetentionMinutes] * 60).toFixed(0));
	} else {
		return 0;
	}
}

function getConfigLogFilesRemovalLimit(): number {
	let config = getConfiguration();
	if (config) {
		return Number((config[configLogFilesRemovalLimit]).toFixed(0));
	} else {
		return 0;
	}
}

