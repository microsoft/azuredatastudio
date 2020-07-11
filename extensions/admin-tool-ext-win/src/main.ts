/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as path from 'path';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TelemetryReporter, TelemetryViews } from './telemetry';
import { getTelemetryErrorType, buildSsmsMinCommandArgs, buildUrn, LaunchSsmsDialogParams, nodeTypeToUrnNameMapping } from './utils';
import { ChildProcess, exec } from 'child_process';
import { promises as fs } from 'fs';

const localize = nls.loadMessageBundle();

let exePath: string;
const runningProcesses: Map<number, ChildProcess> = new Map<number, ChildProcess>();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// This is for Windows-specific support so do nothing on other platforms
	if (process.platform === 'win32') {
		const rawConfig = await fs.readFile(path.join(context.extensionPath, 'config.json'));
		const ssmsMinVer = JSON.parse(rawConfig.toString()).version;
		exePath = path.join(context.extensionPath, 'ssmsmin', 'Windows', ssmsMinVer, 'ssmsmin.exe');
		registerCommands(context);
	}
}

export async function deactivate(): Promise<void> {
	// If the extension is being deactivated we want to kill all processes that are still currently
	// running otherwise they will continue to run as orphan processes. We use taskkill here in case
	// they started off child processes of their own
	runningProcesses.forEach(p => exec(`taskkill /pid ${p.pid} /T /F`));
}

/**
 * Registers extension commands with command subsystem
 * @param context The context used to register the commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('adminToolExtWin.launchSsmsMinPropertiesDialog', handleLaunchSsmsMinPropertiesDialogCommand));
	context.subscriptions.push(
		vscode.commands.registerCommand('adminToolExtWin.launchSsmsMinGswDialog', handleLaunchSsmsMinGswDialogCommand));
}

/**
 * Handler for command to launch SSMS Server Properties dialog
 * @param connectionId The connection context from the command
 */
async function handleLaunchSsmsMinPropertiesDialogCommand(connectionContext?: azdata.ObjectExplorerContext): Promise<void> {
	if (!connectionContext) {
		TelemetryReporter.sendErrorEvent(TelemetryViews.SsmsMinProperties, 'NoConnectionContext');
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionContextForProp', "No ConnectionContext provided for handleLaunchSsmsMinPropertiesDialogCommand"));
		return;
	}

	let nodeType: string;
	if (connectionContext.isConnectionNode) {
		nodeType = 'Server';
	}
	else if (connectionContext.nodeInfo) {
		nodeType = connectionContext.nodeInfo.nodeType;
	} else {
		TelemetryReporter.sendErrorEvent(TelemetryViews.SsmsMinProperties, 'NoOENode');
		vscode.window.showErrorMessage(localize('adminToolExtWin.noOENode', "Could not determine Object Explorer node from connectionContext : {0}", JSON.stringify(connectionContext)));
		return;
	}

	launchSsmsDialog(
		nodeTypeToUrnNameMapping[nodeType].action,
		connectionContext);
}

/**
 * Handler for command to launch SSMS "Generate Script Wizard" dialog
 * @param connectionId The connection context from the command
 */
async function handleLaunchSsmsMinGswDialogCommand(connectionContext?: azdata.ObjectExplorerContext): Promise<void> {
	const action = 'GenerateScripts';
	if (!connectionContext) {
		TelemetryReporter.sendErrorEvent(TelemetryViews.SsmsMinGsw, 'NoConnectionContext');
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionContextForGsw', "No ConnectionContext provided for handleLaunchSsmsMinPropertiesDialogCommand"));
	}

	launchSsmsDialog(
		action,
		connectionContext);
}

/**
 * Launches SsmsMin with parameters from the specified connection
 * @param action The action to launch
 * @param params The params used to construct the command
 * @param urn The URN to pass to SsmsMin
 */
async function launchSsmsDialog(action: string, connectionContext: azdata.ObjectExplorerContext): Promise<void> {
	if (!connectionContext.connectionProfile) {
		TelemetryReporter.sendErrorEvent(TelemetryViews.SsmsMinDialog, 'NoConnectionProfile');
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionProfile', "No connectionProfile provided from connectionContext : {0}", JSON.stringify(connectionContext)));
		return;
	}

	let oeNode: azdata.objectexplorer.ObjectExplorerNode;
	// Server node is a Connection node and so doesn't have the NodeInfo
	if (connectionContext.isConnectionNode) {
		oeNode = undefined;
	}
	else if (connectionContext.nodeInfo && connectionContext.nodeInfo.nodeType && connectionContext.connectionProfile) {
		oeNode = await azdata.objectexplorer.getNode(connectionContext.connectionProfile.id, connectionContext.nodeInfo.nodePath);
	}
	else {
		TelemetryReporter.sendErrorEvent(TelemetryViews.SsmsMinDialog, 'NoOENode');
		vscode.window.showErrorMessage(localize('adminToolExtWin.noOENode', "Could not determine Object Explorer node from connectionContext : {0}", JSON.stringify(connectionContext)));
		return;
	}

	const urn: string = await buildUrn(oeNode);
	let password: string = connectionContext.connectionProfile.password;

	if (!password || password === '') {
		const creds = await azdata.connection.getCredentials(connectionContext.connectionProfile.id);
		password = creds[azdata.ConnectionOptionSpecialType.password];
	}

	const params: LaunchSsmsDialogParams = {
		action: action,
		server: connectionContext.connectionProfile.serverName,
		database: connectionContext.connectionProfile.databaseName,
		user: connectionContext.connectionProfile.userName,
		useAad: connectionContext.connectionProfile.authenticationType === 'AzureMFA',
		urn: urn
	};

	const args = buildSsmsMinCommandArgs(params);
	TelemetryReporter.createActionEvent(
		TelemetryViews.SsmsMinDialog,
		'LaunchSsmsDialog',
		'',
		action).withAdditionalProperties(
			{
				nodeType: oeNode ? oeNode.nodeType : 'Server'
			}).withConnectionInfo(connectionContext.connectionProfile)
		.send();

	vscode.window.setStatusBarMessage(localize('adminToolExtWin.launchingDialogStatus', "Launching dialog..."), 3000);

	// This will be an async call since we pass in the callback
	const proc: ChildProcess = exec(
		/*command*/ `"${exePath}" ${args}`,
		/*options*/ undefined,
		(execException, stdout, stderr) => {
			// Process has exited so remove from map of running processes
			runningProcesses.delete(proc.pid);
			const err = stderr.toString();
			if ((execException && execException.code !== 0) || err !== '') {
				TelemetryReporter.sendErrorEvent(
					TelemetryViews.SsmsMinDialog,
					'LaunchSsmsDialogError',
					execException ? execException.code.toString() : '',
					getTelemetryErrorType(err));
			}

			if (err !== '') {
				vscode.window.showErrorMessage(localize(
					'adminToolExtWin.ssmsMinError',
					"Error calling SsmsMin with args \'{0}\' - {1}", args, err));
			}
		});

	// If we're not using AAD the tool prompts for a password on stdin
	if (params.useAad !== true) {
		proc.stdin.end(password ? password : '');
	}

	// Save the process into our map so we can make sure to stop them if we exit before shutting down
	runningProcesses.set(proc.pid, proc);
}

