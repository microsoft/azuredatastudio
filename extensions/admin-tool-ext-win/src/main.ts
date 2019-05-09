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
import { doubleEscapeSingleQuotes, backEscapeDoubleQuotes, getConfiguration } from './utils';
import { ChildProcess, exec } from 'child_process';

const baseConfig = require('./config.json');
const localize = nls.loadMessageBundle();
let exePath: string;
let runningProcesses: Map<number, ChildProcess> = new Map<number, ChildProcess>();


interface SmoMapping {
	action: string;
	urnName: string;
}

const nodeTypeToUrnNameMapping: { [oeNodeType: string]: SmoMapping } = {
	'Database': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Database', urnName: 'Database' },
	'Server': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Server', urnName: 'Server' },
	'ServerLevelServerAudit': { action: 'sqla:AuditProperties', urnName: 'Audit' },
	'ServerLevelCredential': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Credential', urnName: 'Credential' },
	'ServerLevelServerRole': { action: 'sqla:ManageServerRole', urnName: 'Role' },
	'ServerLevelServerAuditSpecification': { action: 'sqla:ServerAuditSpecificationProperties', urnName: 'ServerAuditSpecification' },
	'ServerLevelLinkedServer': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.LinkedServer', urnName: 'LinkedServer' },
	'Table': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Table', urnName: 'Table' },
	'View': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.View', urnName: 'View' },
	'Column': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Column', urnName: 'Column' },
	'Index': { action: 'sqla:IndexProperties', urnName: 'Index' },
	'Statistic': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Statistic', urnName: 'Statistic' },
	'StoredProcedure': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.StoredProcedure', urnName: 'StoredProcedure' },
	'ScalarValuedFunction': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedFunction', urnName: 'UserDefinedFunction' },
	'TableValuedFunction': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedFunction', urnName: 'UserDefinedFunction' },
	'AggregateFunction': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedFunction', urnName: 'UserDefinedFunction' },
	'Synonym': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Synonym', urnName: 'Synonym' },
	'Assembly': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.SqlAssembly', urnName: 'SqlAssembly' },
	'UserDefinedDataType': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedDataType', urnName: 'UserDefinedDataType' },
	'UserDefinedType': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedType', urnName: 'UserDefinedType' },
	'UserDefinedTableType': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.UserDefinedTableType', urnName: 'UserDefinedTableType' },
	'Sequence': { action: 'sqla:SequenceProperties', urnName: 'Sequence' },
	'User': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.User', urnName: 'User' },
	'DatabaseRole': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.DatabaseRole', urnName: 'Role' },
	'ApplicationRole': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.ApplicationRole', urnName: 'ApplicationRole' },
	'Schema': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Schema', urnName: 'Schema' },
	'SecurityPolicy': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.SecurityPolicy', urnName: 'SecurityPolicy' },
	'ServerLevelLogin': { action: 'sqla:Properties@Microsoft.SqlServer.Management.Smo.Login', urnName: 'Login' },
};

// Params to pass to SsmsMin.exe, only an action and server are required - the rest are optional based on the
// action used. Exported for use in testing.
export interface LaunchSsmsDialogParams {
	action: string;
	server: string;
	database?: string;
	user?: string;
	useAad?: boolean;
	urn?: string;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	// This is for Windows-specific support so do nothing on other platforms
	if (process.platform === 'win32') {
		Telemetry.sendTelemetryEvent('startup/ExtensionActivated');

		let config: IConfig = JSON.parse(JSON.stringify(baseConfig));
		config.installDirectory = path.join(context.extensionPath, config.installDirectory);
		config.proxy = getConfiguration('http').get('proxy');
		config.strictSSL = getConfiguration('http').get('proxyStrictSSL') || true;

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

			// Register the commands now that we have the exePath to run the tool with
			registerCommands(context);

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
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionContextForProp', 'No ConnectionContext provided for handleLaunchSsmsMinPropertiesDialogCommand'));
		return;
	}

	let nodeType: string;
	if (connectionContext.isConnectionNode) {
		nodeType = 'Server';
	}
	else if (connectionContext.nodeInfo) {
		nodeType = connectionContext.nodeInfo.nodeType;
	}
	else {
		vscode.window.showErrorMessage(localize('adminToolExtWin.noOeNode', 'Could not determine NodeType for handleLaunchSsmsMinPropertiesDialogCommand with context {0}', JSON.stringify(connectionContext)));
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
	if (!connectionContext) {
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionContextForGsw', 'No ConnectionContext provided for handleLaunchSsmsMinPropertiesDialogCommand'));
	}

	launchSsmsDialog(
		'GenerateScripts',
		connectionContext);
}

/**
 * Launches SsmsMin with parameters from the specified connection
 * @param action The action to launch
 * @param params The params used to construct the command
 * @param urn The URN to pass to SsmsMin
 */
async function launchSsmsDialog(action: string, connectionContext: azdata.ObjectExplorerContext): Promise<void> {
	if (!exePath) {
		vscode.window.showErrorMessage(localize('adminToolExtWin.noExeError', 'Unable to find SsmsMin.exe.'));
		return;
	}

	if (!connectionContext.connectionProfile) {
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionProfile', 'No connectionProfile provided from connectionContext : {0}', JSON.stringify(connectionContext)));
		return;
	}

	// Currently Azure isn't supported by the SSMS server properties dialog
	const serverInfo = await azdata.connection.getServerInfo(connectionContext.connectionProfile.id);
	if (serverInfo && serverInfo.isCloud) {
		vscode.window.showErrorMessage(localize('adminToolExtWin.invalidEngineType', 'This option is not currently available for this engine type.'));
		return;
	}

	// Note - this is a temporary fix for the issue that currently the connection API doesn't allow retrieving credentials for a disconnected
	// node. So until that's fixed we'll prevent users from attempting to launch SsmsMin on a disconnected node.
	// We also aren't able to hide the menu item on disconnected nodes because we currently don't have a contextKey for the connected status
	// of a node.
	const activeConnections = await azdata.connection.getActiveConnections();
	if (!activeConnections.some(conn => conn.connectionId === connectionContext.connectionProfile.id)) {
		vscode.window.showErrorMessage(localize('adminToolExtWin.notConnected', 'This option requires a connected node - please connect and try again.'));
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
		vscode.window.showErrorMessage(localize('adminToolExtWin.noOENode', 'Could not determine Object Explorer node from connectionContext : {0}', JSON.stringify(connectionContext)));
		return;
	}

	let urn: string = await buildUrn(connectionContext.connectionProfile.serverName, oeNode);
	let password: string = connectionContext.connectionProfile.password;

	if (!password || password === '') {
		let creds = await azdata.connection.getCredentials(connectionContext.connectionProfile.id);
		password = creds[azdata.ConnectionOptionSpecialType.password];
	}

	let params: LaunchSsmsDialogParams = {
		action: action,
		server: connectionContext.connectionProfile.serverName,
		database: connectionContext.connectionProfile.databaseName,
		user: connectionContext.connectionProfile.userName,
		useAad: connectionContext.connectionProfile.authenticationType === 'AzureMFA',
		urn: urn
	};

	let args = buildSsmsMinCommandArgs(params);

	Telemetry.sendTelemetryEvent('LaunchSsmsDialog', { 'action': action });

	// This will be an async call since we pass in the callback
	let proc: ChildProcess = exec(
		/*command*/ `"${exePath}" ${args}`,
		/*options*/ undefined,
		(execException, stdout, stderr) => {
			// Process has exited so remove from map of running processes
			runningProcesses.delete(proc.pid);
			Telemetry.sendTelemetryEvent('LaunchSsmsDialogResult', {
				'action': params.action,
				'returnCode': execException && execException.code ? execException.code.toString() : '0'
			});
			let err = stderr.toString();
			if (err !== '') {
				vscode.window.showErrorMessage(localize(
					'adminToolExtWin.ssmsMinError',
					'Error calling SsmsMin with args \'{0}\' - {1}', args, err));
			}
		});

	// If we're not using AAD the tool prompts for a password on stdin
	if (params.useAad !== true) {
		proc.stdin.end(password ? password : '');
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
	return `${params.action ? '-a "' + backEscapeDoubleQuotes(params.action) + '"' : ''}\
${params.server ? ' -S "' + backEscapeDoubleQuotes(params.server) + '"' : ''}\
${params.database ? ' -D "' + backEscapeDoubleQuotes(params.database) + '"' : ''}\
${params.useAad !== true && params.user ? ' -U "' + backEscapeDoubleQuotes(params.user) + '"' : ''}\
${params.useAad === true ? ' -G' : ''}\
${params.urn ? ' -u "' + backEscapeDoubleQuotes(params.urn) + '"' : ''}`;
}

/**
 * Builds the URN string for a given ObjectExplorerNode in the form understood by SsmsMin
 * @param serverName The name of the Server to use for the Server segment
 * @param node The node to get the URN of
 */
export async function buildUrn(serverName: string, node: azdata.objectexplorer.ObjectExplorerNode): Promise<string> {
	let urnNodes: string[] = [];
	while (node) {
		// Server is special since it's a connection node - always add it as the root
		if (node.nodeType === 'Server') {
			break;
		}
		else if (node.metadata && node.nodeType !== 'Folder') {
			// SFC URN expects Name and Schema to be separate properties
			let urnSegment = node.metadata.schema && node.metadata.schema !== '' ?
				`${nodeTypeToUrnNameMapping[node.nodeType].urnName}[@Name='${doubleEscapeSingleQuotes(node.metadata.name)}' and @Schema='${doubleEscapeSingleQuotes(node.metadata.schema)}']` :
				`${nodeTypeToUrnNameMapping[node.nodeType].urnName}[@Name='${doubleEscapeSingleQuotes(node.metadata.name)}']`;
			urnNodes = [urnSegment].concat(urnNodes);
		}
		node = await node.getParent();
	}
	return [`Server[@Name='${doubleEscapeSingleQuotes(serverName)}']`].concat(urnNodes).join('/');
}