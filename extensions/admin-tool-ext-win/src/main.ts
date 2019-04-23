/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as path from 'path';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IConfig, ServerProvider } from 'service-downloader';
import { Telemetry } from './telemetry';
import * as utils from './utils';
import { ChildProcess, exec } from 'child_process';

const baseConfig = require('./config.json');
const localize = nls.loadMessageBundle();
let exePath: string;
let runningProcesses: Map<number, ChildProcess> = new Map<number, ChildProcess>();

// Params to pass to SsmsMin.exe, only an action and server are required - the rest are optional based on the
// action used. Exported for use in testing.
export interface LaunchSsmsDialogParams {
	action: string;
	server: string;
	database?: string;
	user?: string;
	password?: string;
	useAad?: boolean;
	urn?: string;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// This is for Windows-specific support so do nothing on other platforms
	if (process.platform === 'win32') {
		Telemetry.sendTelemetryEvent('startup/ExtensionActivated');

		let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
		config.installDirectory = path.join(context.extensionPath, config.installDirectory);
		config.proxy = utils.getConfiguration('http').get('proxy');
		config.strictSSL = utils.getConfiguration('http').get('proxyStrictSSL') || true;

		const serverdownloader = new ServerProvider(config);
		const installationStart = Date.now();

		try {
			let downloadedExePath = await serverdownloader.getOrDownloadServer();
			const installationComplete = Date.now();

			// Don't register the command if we couldn't find the EXE since it won't be able to do anything
			if (downloadedExePath) {
				exePath = downloadedExePath;
			} else {
				throw new Error('Could not find SsmsMin.exe after downloading');
			}
			// Add the command now that we have the exePath to run the tool with
			context.subscriptions.push(
				vscode.commands.registerCommand('adminToolExtWin.launchSsmsServerPropertiesDialog', handleLaunchSsmsServerPropertiesDialogCommand));

			Telemetry.sendTelemetryEvent('startup/ExtensionStarted', {
				installationTime: String(installationComplete - installationStart),
				beginningTimestamp: String(installationStart)
			});
		}
		catch (err) {
			Telemetry.sendTelemetryEvent('startup/ExtensionInitializationFailed');
			console.error(`Error Initializing Admin Tool Extension for Windows - ${err}`);
		}
	}
}

export async function deactivate(): Promise<void> {
	// If the extension is being deactivated we want to kill all processes that are still currently
	// running otherwise they will continue to run as orphan processes. We use taskkill here in case
	// they started off child processes of their own
	runningProcesses.forEach(p => exec('taskkill /pid ' + p.pid + ' /T /F'));
}

/**
 * Handler for command to launch SSMS Server Properties dialog
 * @param connectionId The connection context from the command
 */
function handleLaunchSsmsServerPropertiesDialogCommand(connectionContext?: azdata.ObjectExplorerContext) {
	if (connectionContext && connectionContext.connectionProfile) {
		launchSsmsDialog(
			/*action*/'sqla:Properties@Microsoft.SqlServer.Management.Smo.Server',
			/*connectionProfile*/connectionContext.connectionProfile);
	}
}

/**
 * Launches SsmsMin with parameters from the specified connection
 * @param action The action to launch
 * @param params The params used to construct the command
 * @param urn The URN to pass to SsmsMin
 */
function launchSsmsDialog(action: string, connectionProfile: azdata.IConnectionProfile, urn?: string) {
	if (!exePath) {
		vscode.window.showErrorMessage(localize('adminToolExtWin.noExeError', 'Unable to find SsmsMin.exe.'));
		return;
	}

	Telemetry.sendTelemetryEvent('LaunchSsmsDialog', { 'action': action });

	let params: LaunchSsmsDialogParams = {
		action: action,
		server: connectionProfile.serverName,
		database: connectionProfile.databaseName,
		password: connectionProfile.password,
		user: connectionProfile.userName,
		useAad: connectionProfile.authenticationType === 'AzureMFA',
		urn: urn
	};
	let args = buildSsmsMinCommandArgs(params);

	// This will be an async call since we pass in the callback
	let proc: ChildProcess = exec(
		/*command*/`"${exePath}" ${args}`,
		/*options*/undefined,
		(execException, stdout, stderr) => {
			// Process has exited so remove from map of running processes
			runningProcesses.delete(proc.pid);
			Telemetry.sendTelemetryEvent('LaunchSsmsDialogResult', {
				'action': params.action,
				'returnCode': execException && execException.code ? execException.code.toString() : '0'
			});
			let err = stderr.toString();
			if (err !== '') {
				console.warn(`Error calling SsmsMin with args '${args}' - ${err}`);
			}
		});

	// If we're not using AAD the tool prompts for a password on stdin
	if (params.useAad !== true) {
		proc.stdin.end(params.password ? params.password : '');
	}

	// Save the process into our map so we can make sure to stop them if we exit before shutting down
	runningProcesses.set(proc.pid, proc);
}

/**
 * Builds the command arguments to pass to SsmsMin.exe. Values are expected to be escaped correctly
 * already per their - they will be further escaped * for command-line usage but no additional
 * escaping will occur.
 * @param params The params used to build up the command parameter string
 */
export function buildSsmsMinCommandArgs(params: LaunchSsmsDialogParams): string {
	return `${params.action ? '-a "' + params.action.replace(/"/g, '\\"') + '"' : ''}\
${params.server ? ' -S "' + params.server.replace(/"/g, '\\"') + '"' : ''}\
${params.database ? ' -D "' + params.database.replace(/"/g, '\\"') + '"' : ''}\
${params.useAad !== true && params.user ? ' -U "' + params.user.replace(/"/g, '\\"') + '"' : ''}\
${params.useAad === true ? ' -G' : ''}\
${params.urn ? ' -u "' + params.urn.replace(/"/g, '\\"') + '"' : ''}`;
}
