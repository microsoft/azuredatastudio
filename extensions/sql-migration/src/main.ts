/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DashboardWidget } from './dashboard/sqlServerDashboard';
import * as constants from './constants/strings';
import { ServiceClient } from './service/serviceClient';
import { migrationServiceProvider } from './service/provider';
import { TelemetryReporter } from './telemetry';
import { SqlOpsDataClient } from 'dataprotocol-client';

let widget: DashboardWidget;
let migrationServiceClient: SqlOpsDataClient | undefined;
export async function activate(context: vscode.ExtensionContext): Promise<DashboardWidget> {
	if (!migrationServiceProvider) {
		await vscode.window.showErrorMessage(constants.serviceProviderInitializationError);
	}
	// asynchronously starting the service
	const outputChannel = vscode.window.createOutputChannel(constants.serviceName);
	const serviceClient = new ServiceClient(outputChannel);
	migrationServiceClient = await serviceClient.startService(context).catch((e) => {
		console.error(e);
		return undefined;
	});

	widget = new DashboardWidget(context);
	await widget.register();
	context.subscriptions.push(TelemetryReporter);
	return widget;
}

export async function deactivate(): Promise<void> {
	if (migrationServiceClient) {
		await migrationServiceClient.stop();
	}
}
