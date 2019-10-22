/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as path from 'path';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TelemetryReporter, TelemetryViews } from './telemetry';
import { doubleEscapeSingleQuotes, backEscapeDoubleQuotes, getTelemetryErrorType } from './utils';
import { ChildProcess, exec } from 'child_process';
import { promises as fs } from 'fs';

const localize = nls.loadMessageBundle();

let exePath: string;
const runningProcesses: Map<number, ChildProcess> = new Map<number, ChildProcess>();

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
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionContextForProp', 'No ConnectionContext provided for handleLaunchSsmsMinPropertiesDialogCommand'));
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
		vscode.window.showErrorMessage(localize('adminToolExtWin.noOENode', 'Could not determine Object Explorer node from connectionContext : {0}', JSON.stringify(connectionContext)));
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
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionContextForGsw', 'No ConnectionContext provided for handleLaunchSsmsMinPropertiesDialogCommand'));
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
		vscode.window.showErrorMessage(localize('adminToolExtWin.noConnectionProfile', 'No connectionProfile provided from connectionContext : {0}', JSON.stringify(connectionContext)));
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
		vscode.window.showErrorMessage(localize('adminToolExtWin.noOENode', 'Could not determine Object Explorer node from connectionContext : {0}', JSON.stringify(connectionContext)));
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

	vscode.window.setStatusBarMessage(localize('adminToolExtWin.launchingDialogStatus', 'Launching dialog...'), 3000);

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
${params.user ? ' -U "' + backEscapeDoubleQuotes(params.user) + '"' : ''}\
${params.useAad === true ? ' -G' : ''}\
${params.urn ? ' -u "' + backEscapeDoubleQuotes(params.urn) + '"' : ''}`;
}

/**
 * Builds the URN string for a given ObjectExplorerNode in the form understood by SsmsMin
 * @param node The node to get the URN of
 */
export async function buildUrn(node: azdata.objectexplorer.ObjectExplorerNode): Promise<string> {
	let urnNodes: string[] = [];
	while (node) {
		// Server is special since it's a connection node - always add it as the root
		if (node.nodeType === 'Server') {
			break;
		}
		else if (node.metadata && node.nodeType !== 'Folder') {
			// SFC URN expects Name and Schema to be separate properties
			const urnSegment = node.metadata.schema && node.metadata.schema !== '' ?
				`${nodeTypeToUrnNameMapping[node.nodeType].urnName}[@Name='${doubleEscapeSingleQuotes(node.metadata.name)}' and @Schema='${doubleEscapeSingleQuotes(node.metadata.schema)}']` :
				`${nodeTypeToUrnNameMapping[node.nodeType].urnName}[@Name='${doubleEscapeSingleQuotes(node.metadata.name)}']`;
			urnNodes = [urnSegment].concat(urnNodes);
		}
		node = await node.getParent();
	}

	return ['Server'].concat(urnNodes).join('/');
}
