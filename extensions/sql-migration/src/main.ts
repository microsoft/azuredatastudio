/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { SqlMigrationsServer } from './api/server/sqlMigrationsServer';
import { DashboardWidget } from './dashboard/sqlServerDashboard';

let widget: DashboardWidget;
export async function activate(context: vscode.ExtensionContext): Promise<DashboardWidget> {
	const serverLinks = new SqlMigrationsServer();

	const backendServices = await serverLinks.start(context);

	widget = new DashboardWidget(context, backendServices);
	await widget.register();
	return widget;
}

export function deactivate(): void {
}
