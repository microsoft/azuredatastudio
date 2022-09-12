/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DashboardWidget } from './dashboard/sqlServerDashboard';

let widget: DashboardWidget;
export async function activate(context: vscode.ExtensionContext): Promise<DashboardWidget> {
	widget = new DashboardWidget(context);
	await widget.register();
	return widget;
}

export function deactivate(): void {
}
