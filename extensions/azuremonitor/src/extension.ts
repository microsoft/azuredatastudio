// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import { SqlOpsDataClient, ClientOptions, ConnectionFeature, ObjectExplorerFeature, ScriptingFeature, QueryFeature } from 'dataprotocol-client';
import { ServerOptions, TransportKind } from 'vscode-languageclient';
import { localize } from './localization';
import * as Constants from './constants';
import * as Strings from './strings';
import { output } from './ui-references';
import { ClientErrorHandler } from './client-error-handler';

let isActivated = false;

export function activate(context: vscode.ExtensionContext): void {
	if (isActivated) {
		return;
	}

	output.appendLine(
		localize("extension.activating", "Activating {0}.", Strings.extensionName));

	launchServiceClient(path.join(__dirname, '../sqltoolsservice/windows/3.0.0-release.1/MicrosoftKustoServiceLayer.exe'), context);

	isActivated = true;
}

/**
 * ADS calls this function to deactivate our extension.
 * Usually this is because ADS is exiting.
 *
 * @param _context The VSCode extension context
 */
export function deactivate(): void {
	output.appendLine(
		localize("extension.deactivated", "{0} has been deactivated.", Strings.extensionName));
}

function launchServiceClient(executablePath: string, context: vscode.ExtensionContext): SqlOpsDataClient {
	const backendService = new SqlOpsDataClient(Strings.serviceName, getServerOptions(executablePath), getClientOptions());

	backendService
		.onReady()
		.then(() => output.appendLine(localize("extension.activated", "{0} is now active!", Strings.extensionName)));

	// Register backend service for disposal when extension is deactivated
	context.subscriptions.push(backendService.start());

	return backendService;
}

function getServerOptions(executablePath: string): ServerOptions {
	return {
		command: executablePath,
		args: [],
		transport: TransportKind.stdio
	};
}

function getClientOptions(): ClientOptions {
	return {
		providerId: Constants.PROVIDER_ID,
		errorHandler: new ClientErrorHandler(),
		documentSelector: ['kusto'],
		synchronize: {
			configurationSection: 'azuremonitor'
		},
		features: [
			ConnectionFeature,
			ObjectExplorerFeature,
			ScriptingFeature,
			QueryFeature
		]
	};
}
