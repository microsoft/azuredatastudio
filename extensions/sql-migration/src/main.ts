/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DashboardWidget } from './dashboard/sqlServerDashboard';
import * as constants from './constants/strings';
import { ServiceClient } from './service/serviceClient';
import { migrationServiceProvider } from './service/provider';
import { TelemetryReporter } from './telemetry';

let widget: DashboardWidget;
export async function activate(context: vscode.ExtensionContext): Promise<DashboardWidget> {
	if (!migrationServiceProvider) {
		await vscode.window.showErrorMessage(constants.serviceProviderInitializationError);
	}
	// asynchronously starting the service
	const outputChannel = vscode.window.createOutputChannel(constants.serviceName);
	const serviceClient = new ServiceClient(outputChannel);
	serviceClient.startService(context).catch((e) => {
		console.error(e);
	});

	widget = new DashboardWidget(context);
	await widget.register();
	context.subscriptions.push(TelemetryReporter);
	return widget;
}

export function deactivate(): void {
}
